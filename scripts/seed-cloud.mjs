// Generates cloud/seed.sql for the LongEar Diaries D1 backend.
//
//   node scripts/seed-cloud.mjs                 # full seed (schema + content + admin)
//   node scripts/seed-cloud.mjs --rotate        # only rewrite the admin password
//
// Environment:
//   ADMIN_PASSWORD   admin password (a strong one is generated when omitted)
//   ADMIN_EMAIL      admin email (default admin@longeardiaries.com)
//   LONGEAR_CONTENT  content source (default ../../data/content.json)
//
// The generated SQL is applied with:
//   npx wrangler d1 execute longear-db --remote --file cloud/seed.sql
// Passwords are stored only as PBKDF2-SHA256 hashes (100k iterations), the
// same format the Worker verifies.

import { randomBytes, pbkdf2Sync } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const rotate = args.includes('--rotate');
const contentPath = process.env.LONGEAR_CONTENT || path.resolve(root, '../../data/content.json');
const adminEmail = (process.env.ADMIN_EMAIL || 'admin@longeardiaries.com').toLowerCase();
const adminId = 'member-admin';

const sqlString = value => `'${String(value).replaceAll("'", "''")}'`;
const hash = password => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${pbkdf2Sync(password, salt, 100_000, 32, 'sha256').toString('hex')}`;
};
const generatePassword = () => {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*';
  const bytes = randomBytes(18);
  return [...bytes].map(b => alphabet[b % alphabet.length]).join('');
};

const password = process.env.ADMIN_PASSWORD || generatePassword();
const statements = [
  'CREATE TABLE IF NOT EXISTS collections (name TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)',
  'CREATE TABLE IF NOT EXISTS meta (name TEXT PRIMARY KEY, value TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, created_at TEXT NOT NULL, payload TEXT NOT NULL)',
];

if (!rotate) {
  const content = JSON.parse(await readFile(contentPath, 'utf8'));
  content.members = [{
    id: adminId,
    name: 'Editor',
    title: 'Editorial office',
    email: adminEmail,
    role: 'admin',
    active: true,
    public: false,
    bio: 'Keeper of the field office.',
    passwordHash: hash(password),
  }];
  content.settings = { ...(content.settings || {}), teamPhoto: content.settings?.teamPhoto || '' };
  delete content.settings.passwordHash;
  const sessionSecret = randomBytes(32).toString('hex');
  statements.push(
    'DELETE FROM collections',
    'DELETE FROM meta',
    'DELETE FROM snapshots',
    `INSERT INTO collections (name, payload, updated_at) VALUES ('content', ${sqlString(JSON.stringify(content))}, '${new Date().toISOString()}')`,
    `INSERT INTO collections (name, payload, updated_at) VALUES ('mailbox', '[]', '${new Date().toISOString()}')`,
    `INSERT INTO meta (name, value) VALUES ('sessionSecret', ${sqlString(sessionSecret)})`,
  );
} else {
  const members = JSON.stringify([{
    id: adminId,
    name: 'Editor',
    title: 'Editorial office',
    email: adminEmail,
    role: 'admin',
    active: true,
    public: false,
    bio: 'Keeper of the field office.',
    passwordHash: hash(password),
  }]);
  statements.push(`UPDATE collections SET payload = json_set(payload, '$.members', ${sqlString(members)}, '$.revision', 0) WHERE name = 'content'`);
}

await mkdir(path.join(root, 'cloud'), { recursive: true });
await writeFile(path.join(root, 'cloud/seed.sql'), statements.join(';\n') + ';\n');
console.log(`Wrote cloud/seed.sql (${rotate ? 'password rotation' : 'full seed'})`);
if (!process.env.ADMIN_PASSWORD && !rotate) console.log(`Generated admin password: ${password}`);
console.log(`Admin email: ${adminEmail}`);
