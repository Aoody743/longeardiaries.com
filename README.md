# LongEar Diaries — longeardiaries.com

Interactive storybook site for endangered wildlife: a hand-painted 3D Earth
with clickable animal markers, field diaries, events, volunteer stories and a
real editorial office (admin) running on Cloudflare's free tier.

## Live

- **Production** — `https://longeardiaries.com` · static site served by GitHub
  Pages, backend API served by a Cloudflare Worker on the same domain.
- **Preview sandbox** — `https://aoody743.github.io/longeardiaries.com/` ·
  front-end only. Content lives in your browser's IndexedDB and the editorial
  office accepts any email + password (nothing leaves the browser, nothing is
  published).

## Architecture

- **Static SPA** — vanilla ES modules with vendored three.js, hash routing,
  no framework. `npm run build` copies `src/` → `dist/`.
- **Backend** — `worker/main.js`, a Cloudflare Worker attached to the
  `longeardiaries.com/api/*` and `/uploads/*` routes so the editorial office
  runs same-origin (no CORS, `SameSite=Strict` cookies):
  - **D1** (`longear-db`) — content + mailbox collections, revision-checked
    saves, capped snapshot history (last 60 versions).
  - **KV** (`UPLOADS`) — images uploaded through the editorial office.
  - **Auth** — PBKDF2-SHA256 password hashes, HMAC-signed `HttpOnly` session
    cookies (12 h), same-origin enforcement on writes.
- **CI** — GitHub Actions (`.github/workflows/deploy.yml`) builds `dist` and
  publishes it to GitHub Pages on every push to `main`.
- **DNS** — the `longeardiaries.com` zone lives on Cloudflare: apex and `www`
  are proxied CNAMEs to `Aoody743.github.io`, a
  `_github-pages-challenge-Aoody743` TXT verifies the Pages domain, and
  SSL/TLS mode is Full (strict).

## Editorial office

Sign in at `/#admin` on the production domain. The admin account is created
by the seed script — passwords are stored only as PBKDF2 hashes inside D1 and
never appear in this repository.

First-time setup (one-time, run locally where the parent LongEar project
lives):

```sh
npx wrangler login
npx wrangler d1 create longear-db          # put the id into wrangler.toml
npx wrangler kv namespace create UPLOADS   # put the id into wrangler.toml
ADMIN_PASSWORD='choose-a-long-password' npm run seed:cloud
npx wrangler d1 execute longear-db --remote --file cloud/seed.sql
npm run deploy:worker                      # attaches the /api/* + /uploads/* routes
```

`ADMIN_PASSWORD` is optional — when omitted the script generates a strong
password and prints it once. `cloud/` is git-ignored.

Rotate the admin password at any time (content is untouched):

```sh
ADMIN_PASSWORD='new-password' npm run seed:cloud -- --rotate
npx wrangler d1 execute longear-db --remote --file cloud/seed.sql
```

## Local development

From the repository parent (full Python backend: SQLite, version history,
local `.eml` outbox, optional SMTP):

```sh
./run.sh    # http://127.0.0.1:4173
```

`node scripts/prepare-sites.mjs` (run from the parent) refreshes `src/` from
the local app and writes a sanitized `demo-content.json` for the browser
sandbox. Local databases, password hashes, inboxes and history never leave
the machine.

## Notes

- The edge backend stores contact, RSVP and story submissions in the
  editorial inbox; it does not send email.
- Fonts (Cormorant Garamond, Nunito Sans, DM Mono) are bundled locally under
  their SIL Open Font License; three.js, marked and DOMPurify are vendored
  with their licenses under `src/vendor/licenses/`.
