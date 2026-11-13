# Family Ledger

Private PostgreSQL-backed Next.js family ledger with seven authenticated dashboard routes: overview, income, transactions, month comparison, company, refunds, and reconciliation.

The UI keeps currencies separate, restores shareable transaction filters from the URL, distinguishes covered zeroes from unavailable source data, and shows household, company, agency, funding, foreign-household, pending-income, and excluded-income boundaries explicitly. Refund groups are explanatory: a group is included when its original or any linked refund matches the selected filters, while linked rows outside the date range remain visible without changing cashflow. Reconciliation is month-specific and displays coverage, scope notes, pending income, safe original filenames, and dashboard-input hashes.

## Required runtime environment

- `DATABASE_URL`: PostgreSQL connection string. The service uses only the `family_ledger` schema.
- `AUTH_SECRET`: NextAuth signing secret. Authentication fails closed when it is absent.

The production build does not require either variable and does not run migrations. When runtime configuration is incomplete, protected routes return no ledger data.

## Commands

Run from this app directory, or prefix workspace commands with `--filter family-ledger`.

```bash
pnpm dev                # http://localhost:1050
pnpm build              # no database connection required
pnpm typecheck
pnpm test               # pure node:test suites; no external database required
pnpm db:migrate         # explicit, non-destructive CREATE IF NOT EXISTS migration
pnpm import-refund-links -- --file /private/path/refund-evidence.json --dry-run
pnpm import-category-catalog -- --file /private/path/category-catalog.json --dry-run
pnpm publish-dashboard -- --actor migration-operator
```

Create the explicit schema before creating a user:

```bash
DATABASE_URL=... pnpm db:migrate
```

Create or replace a user without putting the password in argv:

```bash
DATABASE_URL=... pnpm admin:user -- --username fictional-admin --role admin < password-file
```

The command reads the password only from stdin, hashes it with bcrypt, and creates no default account.

## Ledger import

The import command accepts the external dashboard JSON file and an optional external account-alias document:

```bash
DATABASE_URL=... pnpm import-ledger -- \
  --file dashboard-months.json \
  --account-aliases account-aliases.json
```

Alias documents are supplied outside the public repository and use this shape:

```json
{
  "accounts": [
    {
      "id": "TEST-CARD-A",
      "label": "Fictional card A",
      "aliases": ["fictional card A"]
    }
  ]
}
```

The importer validates month membership, integer cents, currency, transaction-level totals, income/company/agency headline totals, and mortgage totals. It records the source SHA-256 and original JSON in PostgreSQL, uses deterministic `(month, scope, original id)` transaction keys, and is idempotent for identical source content. Imports preserve months outside the supplied file and refuse to change or remove transactions that have active purpose confirmations or refund links. Browser-facing DTOs expose only a source label and hash, never local file paths or the original JSON.

Deployment and ledger import are independent runtime operations: a build or deployment never imports ledger data. Each explicit import updates only the supplied months, preserves other historical months, and protects rows referenced by active purpose confirmations or refund links from silent replacement or removal.

Validate an input and optional totals snapshot without a database connection or writes:

```bash
pnpm import-ledger -- --file dashboard-months.json --account-aliases account-aliases.json \
  --dry-run --expected-totals before-migration-totals.json
```

Import identity includes byte-level SHA-256 fingerprints for both the dashboard input and alias file, so alias changes are explicit even when ledger bytes are unchanged.

## Monthly workflow

1. Run `import-ledger --dry-run` against the new monthly export and the reviewed totals snapshot.
2. Run `import-ledger` with `DATABASE_URL` to persist the accepted month; protected purpose/refund-linked rows cannot be silently replaced.
3. Log in, review **账单与对账**, resolve pending purposes, and record purpose notes. A note is audit evidence; accounting category changes still require monthly reconciliation and a new import.
4. Validate curated refund evidence with `import-refund-links --dry-run`. The command verifies source hashes plus stable transaction identity, account, scope, currency, gross and group totals, and prints counts/PASS only.
5. Run the same refund command without `--dry-run` after approval. Each file is one transaction, shares the ledger import advisory lock, and is idempotent.
6. Refresh the authenticated dashboard and confirm the refund groups. Monthly cashflow continues to use signed transactions by actual date; links only explain the as-of net and large-expense ranking.

Evidence JSON and source documents stay outside Git. Database evidence may retain private local provenance for audit, while browser DTO sanitization removes paths.

## Classification catalog and published snapshot

Migration `0003-classification-snapshots` is additive. It creates independent `GB`, `QS`, and `ZFB` schemes; stable flat categories (`main_label` + `sub_label`); scheme/scope/source-label rules; per-transaction assignments; append-only audit; catalog-import fingerprints; and the single `published` dashboard snapshot document. It does not update transaction raw data, source category, cents, date, scope, purposes, or refunds. A `(scheme, main_label, sub_label)` is unique, while the same sub-label under a different parent or scheme is valid.

Run the migration, import the externally reviewed catalog, then publish the initial snapshot:

```bash
DATABASE_URL=... pnpm db:migrate
pnpm import-category-catalog -- --file category-catalog.json --dry-run
DATABASE_URL=... pnpm import-category-catalog -- --file category-catalog.json
DATABASE_URL=... pnpm publish-dashboard -- --actor migration-operator
```

Catalog JSON version 1 uses fictional examples here; the real file stays outside the repository:

```json
{
  "version": 1,
  "actor": "catalog-reviewer",
  "categories": [
    { "id": "gb:fictional-food", "scheme": "GB", "mainLabel": "Fictional living", "subLabel": "Fictional food" },
    { "id": "qs:fictional-food", "scheme": "QS", "mainLabel": "Fictional daily", "subLabel": "Fictional food" },
    { "id": "zfb:fictional-food", "scheme": "ZFB", "mainLabel": "Fictional spend", "subLabel": "Fictional food" }
  ],
  "mappings": [
    {
      "scheme": "GB",
      "scope": "household",
      "sourceLabel": "Fictional source label",
      "categoryId": "gb:fictional-food",
      "status": "confirmed",
      "evidence": { "note": "reviewed fictional mapping" }
    }
  ]
}
```

Repeated byte-identical imports are idempotent. Existing categories with a conflicting stable ID fail; existing rule keys are left untouched so monthly catalog imports cannot overwrite later user management. No transaction is inferred by date/amount.

Backend handoff:

- `readPublishedSnapshot()` returns one persisted JSON document or throws `DashboardSnapshotNotReadyError`; there is no raw-query fallback. `refreshPublishedSnapshot(actor)` and `publishDashboardSnapshot(client, actor)` explicitly build/publish version 1. Its `taxonomy` contains scheme revisions, the category catalog, and sanitized effective source-label rules (never rule evidence).
- `getRefundOverview(payload?)` uses a supplied payload when raw construction is explicitly needed, avoiding a second payload build. Normal protected reads use snapshot content. The UI follow-up should call `readPublishedSnapshot()` once per request and pass its three sections to the client.
- Every record exposes immutable `sourceCategory` plus `classifications.GB/QS/ZFB`. An unmapped classification has `status: "pending"` and null labels/category. Scheme selection is display-only.
- Management server actions live in `src/app/actions/classifications.ts`: create; preview/apply rename, merge, split, bulk source-label mapping, and per-transaction override. Apply calls require the exact preview revision/counts/amounts; admins only. Explicit overrides beat rules, while inferred mappings remain distinct from confirmed mappings.
- Merge redirects rules and assignments but retains the merged category ID and audit. Split assigns only explicit transaction IDs and never divides cents. All dashboard-affecting writes use the shared transaction advisory lock and publish before commit; publication failure rolls back the write and preserves the prior valid snapshot.

## Security model

- All ledger pages, APIs, and server actions perform a server-side session check.
- Credentials authentication uses the separate `family_ledger.users` table, bcrypt password hashes, NextAuth-signed sessions, and NextAuth CSRF handling.
- There is no public registration endpoint or default account.
- Failed credentials attempts are throttled in PostgreSQL.
- Refund links and purpose notes require an authenticated admin, the shared import advisory lock, row locks, server-recomputed transaction amounts/currencies, and evidence. Same-day/same-amount rows are never automatically matched.
