# LongEar Diaries — Sites edition

Public storybook site with a genuinely interactive 3D Earth and a front-end
editorial-office demonstration at `/#admin`.

Demo email: `demo@longeardiaries.test`  
Demo password: `LongEarDemo2026!`

The office is a UI demonstration. Edited content, uploaded illustrations and
form submissions stay in this browser's IndexedDB. The sign-in screen is a demo
entry point; it does not secure production accounts or change the shared site.
Settings includes a Reset demo collection action. No email is sent.

The selected Site identity is retained in `.openai/hosting.json`. From the parent
LongEar project, `node scripts/prepare-sites.mjs` refreshes this checkout's `src`
from the local app and creates a sanitized example collection. No local database,
mailbox, account password hashes, history or original documents are published.
Then run `npm run check` and `npm run build` in this directory.

Sites serves `dist` directly. There is no hosted Python service, D1 or R2 binding.
