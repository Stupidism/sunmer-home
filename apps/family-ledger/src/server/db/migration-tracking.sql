CREATE SCHEMA IF NOT EXISTS family_ledger;

CREATE TABLE IF NOT EXISTS family_ledger.schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
