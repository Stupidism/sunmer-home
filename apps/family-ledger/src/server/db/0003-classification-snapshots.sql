CREATE TABLE IF NOT EXISTS family_ledger.classification_schemes (
  code TEXT PRIMARY KEY CHECK (code IN ('GB', 'QS', 'ZFB')),
  label TEXT NOT NULL CHECK (label <> ''),
  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO family_ledger.classification_schemes (code, label)
VALUES ('GB', 'GB'), ('QS', 'QS'), ('ZFB', 'ZFB')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS family_ledger.categories (
  id TEXT PRIMARY KEY CHECK (id ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,99}$'),
  scheme TEXT NOT NULL REFERENCES family_ledger.classification_schemes (code),
  main_label TEXT NOT NULL CHECK (length(btrim(main_label)) BETWEEN 1 AND 100),
  sub_label TEXT NOT NULL CHECK (length(btrim(sub_label)) BETWEEN 1 AND 100),
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'archived', 'merged')),
  merged_into_id TEXT REFERENCES family_ledger.categories (id) ON DELETE RESTRICT,
  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_by TEXT NOT NULL CHECK (created_by <> ''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((state = 'merged') = (merged_into_id IS NOT NULL)),
  CHECK (merged_into_id IS NULL OR merged_into_id <> id),
  UNIQUE (scheme, main_label, sub_label),
  UNIQUE (id, scheme)
);

CREATE TABLE IF NOT EXISTS family_ledger.category_rules (
  id BIGSERIAL PRIMARY KEY,
  scheme TEXT NOT NULL REFERENCES family_ledger.classification_schemes (code),
  ledger_scope TEXT NOT NULL CHECK (ledger_scope IN ('household','company','agency','funding','foreignHousehold','income','pendingIncome','excludedIncome')),
  source_label TEXT NOT NULL CHECK (length(btrim(source_label)) BETWEEN 1 AND 200),
  category_id TEXT NOT NULL REFERENCES family_ledger.categories (id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('inferred', 'confirmed')),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(evidence) = 'object'),
  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_by TEXT NOT NULL CHECK (created_by <> ''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scheme, ledger_scope, source_label),
  FOREIGN KEY (category_id, scheme) REFERENCES family_ledger.categories (id, scheme) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS family_ledger.transaction_classifications (
  transaction_id TEXT NOT NULL REFERENCES family_ledger.transactions (stable_id) ON DELETE RESTRICT,
  scheme TEXT NOT NULL REFERENCES family_ledger.classification_schemes (code),
  category_id TEXT NOT NULL REFERENCES family_ledger.categories (id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('inferred', 'confirmed', 'override')),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(evidence) = 'object'),
  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
  assigned_by TEXT NOT NULL CHECK (assigned_by <> ''),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (transaction_id, scheme),
  FOREIGN KEY (category_id, scheme) REFERENCES family_ledger.categories (id, scheme) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS family_ledger.category_audit (
  id BIGSERIAL PRIMARY KEY,
  scheme TEXT NOT NULL REFERENCES family_ledger.classification_schemes (code),
  operation TEXT NOT NULL CHECK (operation IN ('create','rename','merge','split','map','assign','import')),
  category_id TEXT REFERENCES family_ledger.categories (id) ON DELETE RESTRICT,
  actor TEXT NOT NULL CHECK (actor <> ''),
  before_state JSONB,
  after_state JSONB,
  affected_counts JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(affected_counts) = 'object'),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(evidence) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION family_ledger.require_active_category_target()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_state TEXT;
BEGIN
  SELECT state INTO target_state FROM family_ledger.categories
    WHERE id = NEW.category_id AND scheme = NEW.scheme;
  IF target_state IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'classification target must be an active category in the same scheme';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS category_rules_active_target ON family_ledger.category_rules;
CREATE TRIGGER category_rules_active_target BEFORE INSERT OR UPDATE OF category_id, scheme
ON family_ledger.category_rules FOR EACH ROW EXECUTE FUNCTION family_ledger.require_active_category_target();
DROP TRIGGER IF EXISTS transaction_classifications_active_target ON family_ledger.transaction_classifications;
CREATE TRIGGER transaction_classifications_active_target BEFORE INSERT OR UPDATE OF category_id, scheme
ON family_ledger.transaction_classifications FOR EACH ROW EXECUTE FUNCTION family_ledger.require_active_category_target();

CREATE OR REPLACE FUNCTION family_ledger.reject_category_audit_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'category_audit is append-only';
END;
$$;

DROP TRIGGER IF EXISTS category_audit_append_only ON family_ledger.category_audit;
CREATE TRIGGER category_audit_append_only
BEFORE UPDATE OR DELETE ON family_ledger.category_audit
FOR EACH ROW EXECUTE FUNCTION family_ledger.reject_category_audit_mutation();

CREATE TABLE IF NOT EXISTS family_ledger.dashboard_snapshots (
  name TEXT PRIMARY KEY CHECK (name = 'published'),
  snapshot_version INTEGER NOT NULL CHECK (snapshot_version = 1),
  document JSONB NOT NULL CHECK (jsonb_typeof(document) = 'object'),
  published_at TIMESTAMPTZ NOT NULL,
  published_by TEXT NOT NULL CHECK (published_by <> '')
);

CREATE TABLE IF NOT EXISTS family_ledger.category_catalog_imports (
  sha256 CHAR(64) PRIMARY KEY,
  source_label TEXT NOT NULL CHECK (source_label <> ''),
  imported_by TEXT NOT NULL CHECK (imported_by <> ''),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS category_rules_target_idx ON family_ledger.category_rules (category_id);
CREATE INDEX IF NOT EXISTS transaction_classifications_target_idx ON family_ledger.transaction_classifications (category_id);
CREATE INDEX IF NOT EXISTS transaction_classifications_scheme_idx ON family_ledger.transaction_classifications (scheme, transaction_id);
