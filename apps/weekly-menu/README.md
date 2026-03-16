# weekly-menu

## Production Deployment (Vercel)

This app follows the same deployment pattern as `bubu-log`:

- `vercel.json` with `turbo-ignore` for monorepo-safe deploy checks
- Build script `scripts/vercel-build.sh`
- Optional DB bootstrap on build via `RUN_DB_BOOTSTRAP_ON_BUILD=1`

### Required Environment Variables

Set these in Vercel (Production + Preview as needed):

- `PAYLOAD_DATABASE_URL` (or `DATABASE_URL`)
- `PAYLOAD_SECRET`
- `AUTH_SECRET` (or `NEXTAUTH_SECRET`)
- `AUTH_TRUST_HOST=true`

Recommended:

- `DATABASE_URL_UNPOOLED` (if your DB provider offers pooled/unpooled URLs)

### First Deployment Notes

Payload collections need DB tables on first run.

Option A (recommended for first deploy only):

- Temporarily set:
  - `PAYLOAD_DB_PUSH=true`
  - `PAYLOAD_ALLOW_DESTRUCTIVE_PUSH=true`
- Deploy once to initialize Payload tables.
- Then set both values back to `false`.

Option B:

- Initialize schema manually beforehand, then deploy with push disabled.

### Optional Build-Time Bootstrap

To ensure custom non-Payload tables/indexes exist on deploy, enable:

- `RUN_DB_BOOTSTRAP_ON_BUILD=1`

This executes `node scripts/bootstrap-db.mjs` before `next build`.

## PR Test Preview Link (GitHub Action)

To get PR comments with weekly-menu test preview links (same style as the linked bubu-log comment), configure:

- Workflow file: `.github/workflows/weekly-menu-e2b-preview.yml`
- Required secrets:
  - `WEEKLY_MENU_E2B_API_KEY`
  - `WEEKLY_MENU_E2B_PREVIEW_ENV_B64` (base64-encoded dotenv content)
- Required repo variables:
  - `WEEKLY_MENU_E2B_TEMPLATE`
  - `WEEKLY_MENU_E2B_TIMEOUT_MS`

`WEEKLY_MENU_E2B_PREVIEW_ENV_B64` should include at least:

- `PAYLOAD_DATABASE_URL` (or `DATABASE_URL`)
- `PAYLOAD_SECRET`
- `AUTH_SECRET` (or `NEXTAUTH_SECRET`)
- `AUTH_TRUST_HOST=true`

Notes:

- The workflow is path-scoped to weekly-menu changes.
- It uses isolated sandbox metadata (`pr-preview-weekly-menu`) to avoid conflicts with existing bubu-log E2B preview workflow.

## Database Admin (Payload CMS)

This app now follows the same admin approach as `bubu-log`: Payload CMS Admin.

### Install

```bash
cd apps/weekly-menu
npm install
```

### Run app and open admin

```bash
cd apps/weekly-menu
npm run dev
```

Open admin: `http://localhost:1040/admin`

### First-time setup note

Payload tables must exist in your PostgreSQL database.

If admin says the DB is not initialized, temporarily run with:

```bash
PAYLOAD_DB_PUSH=true PAYLOAD_ALLOW_DESTRUCTIVE_PUSH=true npm run dev
```

After tables are created, go back to normal `npm run dev`.
