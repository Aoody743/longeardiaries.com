// LongEar Diaries — Cloudflare Worker backend.
// A faithful port of the local Python editorial server (server.py) to the
// edge, attached to the /api/* and /uploads/* routes of the site domain.
// D1 stores the content and mailbox collections, KV stores uploaded images,
// sessions are stateless HMAC-signed cookies, and passwords use the same
// `salt:hash` PBKDF2-SHA256 format as the local server so hashes stay
// portable between the two.

const ITERATIONS = 100_000;
const SESSION_TTL_SECONDS = 43_200; // 12 hours, matching the local server.
const MAX_BODY = 8 * 1024 * 1024;
const MAX_HISTORY = 60;
const COOKIE = 'longear_session';

const enc = new TextEncoder();
const now = () => new Date().toISOString();

const json = (payload, status = 200, headers = {}) => new Response(JSON.stringify(payload), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'Cache-Control': 'no-store', ...headers },
});
const fail = (status, message) => json({ error: message }, status);

// User-facing validation failures become 400 responses carrying the message.
class RequestError extends Error {}

const hex = buffer => [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function pbkdf2Hex(password, salt, iterations = ITERATIONS) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations }, key, 256);
  return hex(bits);
}

async function hashPassword(password, salt = null) {
  salt = salt || hex(crypto.getRandomValues(new Uint8Array(16)));
  return `${salt}:${await pbkdf2Hex(password, salt)}`;
}

async function checkPassword(password, encoded) {
  try {
    const [salt] = String(encoded).split(':');
    return constantTimeEqual(await hashPassword(password, salt), encoded);
  } catch {
    return false;
  }
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

// ---------- D1 storage ----------

async function loadCollection(env, name, fallback) {
  const row = await env.DB.prepare('SELECT payload FROM collections WHERE name = ?1').bind(name).first();
  return row ? JSON.parse(row.payload) : structuredClone(fallback);
}

async function saveCollection(env, name, value) {
  await env.DB.prepare('INSERT INTO collections (name, payload, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(name) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at')
    .bind(name, JSON.stringify(value), now()).run();
}

async function snapshot(env, kind, value) {
  await env.DB.prepare('INSERT INTO snapshots (kind, created_at, payload) VALUES (?1, ?2, ?3)')
    .bind(kind, now(), JSON.stringify(value)).run();
  await env.DB.prepare(`DELETE FROM snapshots WHERE id NOT IN (SELECT id FROM snapshots ORDER BY id DESC LIMIT ${MAX_HISTORY})`).run();
}

async function sessionSecret(env) {
  const row = await env.DB.prepare('SELECT value FROM meta WHERE name = ?1').bind('sessionSecret').first();
  if (row) return row.value;
  const secret = hex(crypto.getRandomValues(new Uint8Array(32)));
  await env.DB.prepare('INSERT INTO meta (name, value) VALUES (?1, ?2) ON CONFLICT(name) DO UPDATE SET value = excluded.value')
    .bind('sessionSecret', secret).run();
  return secret;
}

// ---------- views ----------

const publicMember = ({ passwordHash, ...rest }) => rest;

const adminView = content => {
  const result = structuredClone(content);
  result.members = (result.members || []).map(publicMember);
  return result;
};

function publicView(content) {
  const result = adminView(content);
  const showDemo = result.settings?.showDemo !== false;
  for (const key of ['species', 'stories', 'events', 'partners']) {
    result[key] = (result[key] || []).filter(x => x.published !== false && !x.archived && (showDemo || !x.example));
  }
  result.team = (result.team || [])
    .filter(p => p.public !== false && !p.archived && (showDemo || !p.example))
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  result.members = (result.members || [])
    .filter(m => m.public && m.active !== false)
    .map(({ email, role, active, ...rest }) => rest);
  return result;
}

// ---------- session cookie ----------

function readCookie(request, name) {
  for (const part of (request.headers.get('Cookie') || '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

async function currentMember(request, env) {
  const token = readCookie(request, COOKIE);
  if (!token) return null;
  const [tag, memberId, expiry, signature] = token.split('.');
  if (tag !== 'v1' || !memberId || !expiry || !signature || Number(expiry) * 1000 < Date.now()) return null;
  const expected = await hmacHex(await sessionSecret(env), `${memberId}.${expiry}`);
  if (!constantTimeEqual(signature, expected)) return null;
  const content = await loadCollection(env, 'content', {});
  return (content.members || []).find(m => m.id === memberId && m.active !== false) || null;
}

const sessionCookie = (token, maxAge) => `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;

function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  const target = new URL(request.url);
  return origin === `${target.protocol}//${target.hostname}`;
}

async function readBody(request) {
  const raw = await request.arrayBuffer();
  if (!raw.byteLength || raw.byteLength > MAX_BODY) throw new RequestError('The request is empty or too large.');
  let value;
  try {
    value = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    throw new RequestError('A JSON object is required.');
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new RequestError('A JSON object is required.');
  return value;
}

// ---------- endpoints ----------

async function receiveMessage(env, payload) {
  const email = String(payload.email ?? payload.from ?? '').trim();
  let subject = String(payload.subject ?? '').trim();
  const name = String(payload.name ?? '').trim();
  const text = String(payload.message ?? payload.text ?? '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name || !text || !subject) throw new RequestError('Please enter your name, a valid email, a subject and a message.');
  if (text.length > 15000 || name.length > 160 || subject.length > 300) throw new RequestError('Please shorten your message.');
  let kind = String(payload.type ?? 'Contact');
  if (!['Contact', 'Event RSVP', 'Volunteer story', 'Partnership inquiry'].includes(kind)) kind = 'Contact';

  const content = await loadCollection(env, 'content', {});
  if (kind === 'Event RSVP') {
    const event = (content.events || []).find(e => e.id === payload.eventId && e.published && !e.archived);
    if (!event) throw new RequestError('This event is no longer open for registration.');
    subject = `RSVP: ${event.title}`;
  }
  const location = String(payload.location ?? '').trim().slice(0, 300);
  const photoUrl = String(payload.photoUrl ?? '').trim().slice(0, 2000);
  if (photoUrl && !/^https?:\/\/[^\s]+$/.test(photoUrl)) throw new RequestError('Use an http or https address for the photo reference.');

  const message = {
    id: crypto.randomUUID().replaceAll('-', ''), createdAt: now(), type: kind, name, from: email,
    subject, text, status: 'new', delivery: 'stored', eventId: payload.eventId, location, photoUrl,
  };
  if (kind === 'Volunteer story') {
    await snapshot(env, 'before-story', content);
    const storyId = 'submitted-' + message.id.slice(0, 12);
    content.stories = content.stories || [];
    content.stories.push({ id: storyId, title: subject, author: name, location, body: text, image: '', photoUrl, published: false, archived: false, example: false, source: 'community-submission' });
    message.storyId = storyId;
    content.revision = (content.revision || 0) + 1;
    content.updatedAt = now();
    await saveCollection(env, 'content', content);
  }
  const mailbox = await loadCollection(env, 'mailbox', []);
  mailbox.push(message);
  await saveCollection(env, 'mailbox', mailbox);
  return json({ ok: true, id: message.id, delivery: message.delivery }, 201);
}

const subsetEqual = (a, b) => {
  if (a !== null && typeof a === 'object') {
    if (b === null || typeof b !== 'object') return false;
    return Object.entries(a).every(([k, v]) => k in b && subsetEqual(v, b[k]));
  }
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => subsetEqual(x, b[i]));
  return a === b;
};

async function importLegacy(env, legacy) {
  if (typeof legacy !== 'object' || legacy === null || Array.isArray(legacy)) throw new RequestError('The previous collection is not readable.');
  const content = await loadCollection(env, 'content', {});
  await snapshot(env, 'import-archive', { legacy, content });
  let count = 0;
  for (const key of ['species', 'stories', 'events']) {
    for (const item of legacy[key] || []) {
      if (typeof item !== 'object' || item === null) continue;
      const fingerprint = hex(await crypto.subtle.digest('SHA-256', enc.encode(JSON.stringify(item))));
      if ((content[key] || []).some(x => x.legacyFingerprint === fingerprint)) continue;
      const existing = (content[key] || []).find(x => (item.slug && x.slug === item.slug) || (item.id && x.id === item.id) || (item.title && x.title === item.title));
      if (existing && subsetEqual(item, existing)) continue;
      const record = structuredClone(existing || {});
      Object.assign(record, item);
      record.id = 'import-' + crypto.randomUUID().replaceAll('-', '').slice(0, 12);
      record.published = false;
      record.archived = false;
      record.legacyFingerprint = fingerprint;
      record.image ??= 'assets/expedition-hero.png';
      if (key === 'species') {
        const base = String(record.slug || record.name || 'species').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
        record.slug = `${base}-legacy-${record.id.slice(-6)}`;
        record.latitude ??= 0;
        record.longitude ??= 0;
        record.diary ??= [];
      }
      (content[key] = content[key] || []).push(record);
      count++;
    }
  }
  const messages = await loadCollection(env, 'mailbox', []);
  for (const item of legacy.inbox || []) {
    if (typeof item !== 'object' || item === null) continue;
    if (messages.some(x => x.subject === item.subject && x.from === item.from && x.text === item.text)) continue;
    messages.push({ ...item, id: crypto.randomUUID().replaceAll('-', ''), createdAt: now(), delivery: 'stored', source: 'previous browser archive', status: item.status || 'new' });
    count++;
  }
  await saveCollection(env, 'mailbox', messages);
  content.revision = (content.revision || 0) + 1;
  content.updatedAt = now();
  await saveCollection(env, 'content', content);
  return json({ imported: count, content: adminView(content) });
}

async function saveState(env, request, member) {
  const payload = await readBody(request);
  const old = await loadCollection(env, 'content', {});
  if (payload.revision !== old.revision) return fail(409, 'The content changed in another tab. Reload the office before saving again.');
  payload.team ??= old.team || [];
  for (const key of ['species', 'events', 'stories', 'members', 'partners', 'team']) {
    if (!Array.isArray(payload[key])) throw new RequestError('Missing content collection: ' + key);
  }
  if (typeof payload.settings !== 'object' || payload.settings === null) throw new RequestError('Missing site settings.');
  if (payload.species.length > 500 || payload.members.length > 100 || payload.team.length > 100) throw new RequestError('This collection is too large.');
  for (const key of ['species', 'stories', 'events', 'partners', 'members', 'team']) {
    const ids = payload[key].map(x => x.id);
    if (ids.some(id => !id) || new Set(ids).size !== ids.length) throw new RequestError('Records need unique IDs.');
  }
  const slugs = payload.species.map(s => s.slug);
  if (new Set(slugs).size !== slugs.length || slugs.some(slug => !/^[a-z0-9-]*$/.test(slug || ''))) throw new RequestError('Species need unique lowercase URL slugs.');
  for (const s of payload.species) {
    if (!(Number(s.latitude) >= -90 && Number(s.latitude) <= 90 && Number(s.longitude) >= -180 && Number(s.longitude) <= 180)) throw new RequestError('Map coordinates are out of range.');
    if (!Array.isArray(s.diary)) throw new RequestError('A species must have a diary list.');
  }
  for (const profile of payload.team) {
    if (!String(profile.name || '').trim() || !Number.isFinite(Number(profile.order ?? 0))) throw new RequestError('Team profiles need a name and a finite display order.');
    if (String(profile.bio || '').length > 10000) throw new RequestError('Please shorten the team introduction.');
  }
  if (member.role !== 'admin') {
    payload.members = old.members || [];
  } else {
    const emails = payload.members.map(m => String(m.email || '').trim().toLowerCase());
    if (new Set(emails).size !== emails.length || emails.some(email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new RequestError('Members need valid, unique email addresses.');
    for (const m of payload.members) {
      const prior = (old.members || []).find(x => x.id === m.id) || {};
      const password = String(m.password ?? '');
      delete m.password;
      if (password && password.length < 10) throw new RequestError('Use at least 10 characters for a member password.');
      m.passwordHash = password ? await hashPassword(password) : prior.passwordHash;
      if (!prior.id && !password) throw new RequestError('Set a password for the new member.');
      if (!['admin', 'editor'].includes(m.role)) throw new RequestError('Choose an admin or editor role.');
    }
    if (!payload.members.some(m => m.role === 'admin' && m.active !== false)) throw new RequestError('Keep at least one active administrator.');
  }
  await snapshot(env, 'before-save', old);
  payload.revision = (old.revision || 0) + 1;
  payload.updatedAt = now();
  await saveCollection(env, 'content', payload);
  return json(adminView(payload));
}

async function serveUpload(env, path) {
  const key = decodeURIComponent(path.replace(/^\/uploads\//, ''));
  if (!key || key.includes('..') || key.includes('/')) return fail(404, 'This image could not be found.');
  const value = await env.UPLOADS.get(`uploads/${key}`);
  if (!value) return fail(404, 'This image could not be found.');
  const types = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };
  return new Response(await value.arrayBuffer(), {
    headers: { 'Content-Type': types[key.split('.').pop()] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' },
  });
}

async function handle(request, env) {
  const { pathname: path } = new URL(request.url);
  if (path.startsWith('/uploads/')) return serveUpload(env, path);

  if (request.method === 'GET') {
    if (path === '/api/content') return json(await publicView(await loadCollection(env, 'content', {})));
    if (path === '/api/session') return json({ member: (m => m ? publicMember(m) : null)(await currentMember(request, env)) });
    if (path === '/api/health') return json({ ok: true, storage: 'd1', mirror: 'kv uploads', mail: 'inbox only' });
    if (path === '/api/admin/state') {
      const member = await currentMember(request, env);
      return member ? json(adminView(await loadCollection(env, 'content', {}))) : fail(401, 'Please sign in to the field office.');
    }
    if (path === '/api/admin/inbox') {
      const member = await currentMember(request, env);
      return member ? json({ messages: await loadCollection(env, 'mailbox', []) }) : fail(401, 'Please sign in to the field office.');
    }
    if (path.startsWith('/api/')) return fail(404, 'That endpoint does not exist.');
    return fail(404, 'That endpoint does not exist.');
  }

  if (!sameOrigin(request)) return fail(403, 'This request must come from the site itself.');

  if (request.method === 'POST') {
    if (path === '/api/login') {
      const payload = await readBody(request);
      const email = String(payload.email || '').trim().toLowerCase();
      const content = await loadCollection(env, 'content', {});
      const member = (content.members || []).find(m => String(m.email || '').toLowerCase() === email && m.active !== false);
      if (!member || !await checkPassword(String(payload.password || ''), member.passwordHash || '')) return fail(401, 'That email and password do not match.');
      const expiry = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
      const token = `v1.${member.id}.${expiry}.${await hmacHex(await sessionSecret(env), `${member.id}.${expiry}`)}`;
      return json({ member: publicMember(member) }, 200, { 'Set-Cookie': sessionCookie(token, SESSION_TTL_SECONDS) });
    }
    if (path === '/api/logout') return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
    if (path === '/api/contact') return receiveMessage(env, await readBody(request));
    if (path === '/api/admin/upload') {
      const member = await currentMember(request, env);
      if (!member) return fail(401, 'Please sign in to the field office.');
      const payload = await readBody(request);
      const raw = Uint8Array.from(atob(String(payload.data || '')), c => c.charCodeAt(0));
      if (raw.byteLength > 5 * 1024 * 1024) throw new RequestError('Please choose an image smaller than 5 MB.');
      const head = raw.slice(0, 12);
      const ascii = [...head].map(b => String.fromCharCode(b)).join('');
      const ext = head[0] === 0x89 && head[1] === 0x50 ? 'png' : head[0] === 0xff && head[1] === 0xd8 ? 'jpg' : ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP' ? 'webp' : null;
      if (!ext) throw new RequestError('Choose a PNG, JPEG or WebP image.');
      const name = crypto.randomUUID().replaceAll('-', '') + '.' + ext;
      await env.UPLOADS.put(`uploads/${name}`, raw);
      return json({ url: 'uploads/' + name }, 201);
    }
    if (path === '/api/admin/import-legacy') {
      const member = await currentMember(request, env);
      if (!member) return fail(401, 'Please sign in to the field office.');
      return importLegacy(env, (await readBody(request)).legacy);
    }
    return fail(404, 'That endpoint does not exist.');
  }

  if (request.method === 'PUT') {
    const member = await currentMember(request, env);
    if (!member) return fail(401, 'Please sign in to the field office.');
    if (path === '/api/admin/state') return saveState(env, request, member);
    if (path === '/api/admin/inbox') {
      const payload = await readBody(request);
      const records = await loadCollection(env, 'mailbox', []);
      const record = records.find(x => x.id === payload.id);
      if (!record) return fail(404, 'This message could not be found.');
      record.status = payload.status === 'handled' ? 'handled' : 'new';
      await saveCollection(env, 'mailbox', records);
      return json({ ok: true });
    }
    return fail(404, 'That endpoint does not exist.');
  }
  return fail(404, 'That endpoint does not exist.');
}

export default {
  async fetch(request, env) {
    try {
      return await handle(request, env);
    } catch (error) {
      if (error instanceof Response) return error;
      if (error && error.response instanceof Response) return error.response;
      if (error instanceof RequestError) return fail(400, error.message);
      if (error instanceof SyntaxError) return fail(400, 'A JSON object is required.');
      console.error('[LongEar] Request failed:', error && error.stack || error);
      return fail(500, 'The server could not process this request. Please try again.');
    }
  },
};
