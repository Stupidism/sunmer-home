import * as migration_20260220_045727_payload_init from './20260220_045727_payload_init';
import * as migration_20260220_114214 from './20260220_114214';
import * as migration_20260222_163400_baby_full_name from './20260222_163400_baby_full_name';
import * as migration_20260403_120000_supplement_probiotics_prebiotics from './20260403_120000_supplement_probiotics_prebiotics';

export const migrations = [
  {
    up: migration_20260220_045727_payload_init.up,
    down: migration_20260220_045727_payload_init.down,
    name: '20260220_045727_payload_init',
  },
  {
    up: migration_20260220_114214.up,
    down: migration_20260220_114214.down,
    name: '20260220_114214'
  },
  {
    up: migration_20260222_163400_baby_full_name.up,
    down: migration_20260222_163400_baby_full_name.down,
    name: '20260222_163400_baby_full_name',
  },
  {
    up: migration_20260403_120000_supplement_probiotics_prebiotics.up,
    down: migration_20260403_120000_supplement_probiotics_prebiotics.down,
    name: '20260403_120000_supplement_probiotics_prebiotics',
  },
];
