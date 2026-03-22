import * as migration_20260228_011700_template_records from './20260228_011700_template_records'

export const migrations = [
  {
    up: migration_20260228_011700_template_records.up,
    down: migration_20260228_011700_template_records.down,
    name: '20260228_011700_template_records',
  },
]
