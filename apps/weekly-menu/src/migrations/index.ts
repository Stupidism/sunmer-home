import * as migration_20260318_120000_align_weekly_menu_schema from './20260318_120000_align_weekly_menu_schema'
import * as migration_20260318_130000_add_missing_timestamps from './20260318_130000_add_missing_timestamps'

export const migrations = [
  {
    up: migration_20260318_120000_align_weekly_menu_schema.up,
    down: migration_20260318_120000_align_weekly_menu_schema.down,
    name: '20260318_120000_align_weekly_menu_schema',
  },
  {
    up: migration_20260318_130000_add_missing_timestamps.up,
    down: migration_20260318_130000_add_missing_timestamps.down,
    name: '20260318_130000_add_missing_timestamps',
  },
]
