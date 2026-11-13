CREATE SCHEMA IF NOT EXISTS family_ledger;

CREATE TABLE IF NOT EXISTS family_ledger.imports (
  id BIGSERIAL PRIMARY KEY,
  source_label TEXT NOT NULL CHECK (source_label <> ''),
  source_sha256 CHAR(64) NOT NULL,
  account_aliases_sha256 CHAR(64) NOT NULL,
  payload JSONB NOT NULL,
  account_aliases JSONB NOT NULL DEFAULT '{}'::jsonb,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE family_ledger.imports
  ADD COLUMN IF NOT EXISTS account_aliases_sha256 CHAR(64);
ALTER TABLE family_ledger.imports
  DROP CONSTRAINT IF EXISTS imports_source_label_source_sha256_key;
CREATE UNIQUE INDEX IF NOT EXISTS imports_source_alias_version_idx
  ON family_ledger.imports (source_label, source_sha256, account_aliases_sha256);

CREATE TABLE IF NOT EXISTS family_ledger.months (
  month TEXT PRIMARY KEY CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  import_id BIGINT NOT NULL REFERENCES family_ledger.imports (id),
  report_status TEXT NOT NULL,
  report_meta JSONB NOT NULL,
  coverage JSONB,
  income_available BOOLEAN NOT NULL,
  income_complete BOOLEAN NOT NULL
);

CREATE TABLE IF NOT EXISTS family_ledger.transactions (
  stable_id TEXT PRIMARY KEY,
  month TEXT NOT NULL REFERENCES family_ledger.months (month),
  original_id TEXT NOT NULL CHECK (original_id <> ''),
  scope TEXT NOT NULL CHECK (
    scope IN (
      'household',
      'company',
      'agency',
      'funding',
      'foreignHousehold',
      'income',
      'pendingIncome',
      'excludedIncome'
    )
  ),
  transaction_date DATE NOT NULL,
  cents BIGINT NOT NULL CHECK (
    cents >= -9007199254740991
    AND cents <= 9007199254740991
  ),
  currency TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  account TEXT NOT NULL DEFAULT '',
  account_key TEXT NOT NULL DEFAULT '',
  account_label TEXT NOT NULL DEFAULT '',
  raw JSONB NOT NULL,
  raw_sha256 CHAR(64) NOT NULL,
  import_id BIGINT NOT NULL REFERENCES family_ledger.imports (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (month, scope, original_id)
);

CREATE TABLE IF NOT EXISTS family_ledger.purpose_confirmations (
  id BIGSERIAL PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES family_ledger.transactions (stable_id) ON DELETE RESTRICT,
  purpose TEXT NOT NULL CHECK (purpose <> ''),
  evidence JSONB NOT NULL,
  confirmed_by TEXT NOT NULL CHECK (confirmed_by <> ''),
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_imported BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  CHECK (jsonb_typeof(evidence) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS purpose_confirmations_one_active
  ON family_ledger.purpose_confirmations (transaction_id)
  WHERE active;

CREATE TABLE IF NOT EXISTS family_ledger.refund_links (
  id BIGSERIAL PRIMARY KEY,
  expense_transaction_id TEXT NOT NULL REFERENCES family_ledger.transactions (stable_id),
  refund_transaction_id TEXT NOT NULL REFERENCES family_ledger.transactions (stable_id),
  allocation_cents BIGINT NOT NULL CHECK (
    allocation_cents > 0
    AND allocation_cents <= 9007199254740991
  ),
  currency TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  evidence JSONB NOT NULL CHECK (jsonb_typeof(evidence) = 'object'),
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed')),
  created_by TEXT NOT NULL CHECK (created_by <> ''),
  confirmed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (expense_transaction_id <> refund_transaction_id),
  UNIQUE (expense_transaction_id, refund_transaction_id)
);

CREATE TABLE IF NOT EXISTS family_ledger.users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE CHECK (username <> '' AND username = lower(username)),
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'viewer')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS family_ledger.login_throttles (
  throttle_key TEXT PRIMARY KEY,
  failed_attempts INTEGER NOT NULL CHECK (failed_attempts >= 0),
  last_attempt_at TIMESTAMPTZ NOT NULL,
  locked_until TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS transactions_month_scope_idx
  ON family_ledger.transactions (month, scope, transaction_date);
CREATE INDEX IF NOT EXISTS refund_links_expense_idx
  ON family_ledger.refund_links (expense_transaction_id);
CREATE INDEX IF NOT EXISTS refund_links_refund_idx
  ON family_ledger.refund_links (refund_transaction_id);
