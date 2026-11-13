import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { z } from 'zod'
import { validateCategoryName, validateSourceLabel } from '../src/lib/domain/classification'
import { getPool, withTransaction } from '../src/server/db/pool'
import { DASHBOARD_WRITE_LOCK, publishDashboardSnapshot } from '../src/server/repository'

const scheme = z.enum(['GB', 'QS', 'ZFB'])
const scope = z.enum(['household','company','agency','funding','foreignHousehold','income','pendingIncome','excludedIncome'])
const fileSchema = z.object({
  version: z.literal(1),
  actor: z.string().trim().min(1).max(100),
  categories: z.array(z.object({ id: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,99}$/), scheme, mainLabel: z.string(), subLabel: z.string() })),
  mappings: z.array(z.object({ scheme, scope, sourceLabel: z.string(), categoryId: z.string(), status: z.enum(['inferred','confirmed']), evidence: z.record(z.string(), z.unknown()).default({}) })).default([]),
})

function args(argv: string[]) {
  let file = ''; let dryRun = false
  for (let i=0;i<argv.length;i++) { if (argv[i] === '--') continue; if (argv[i] === '--file') file=argv[++i] ?? ''; else if (argv[i] === '--dry-run') dryRun=true; else throw new Error(`unknown argument: ${argv[i]}`) }
  if (!file) throw new Error('usage: pnpm import-category-catalog -- --file category-catalog.json [--dry-run]')
  return { file, dryRun }
}

async function main() {
  const input = args(process.argv.slice(2)); const bytes = await readFile(input.file); const parsed = fileSchema.parse(JSON.parse(bytes.toString('utf8')))
  const ids = new Set<string>(); const names = new Set<string>()
  for (const item of parsed.categories) {
    item.mainLabel = validateCategoryName(item.mainLabel, 'main label'); item.subLabel = validateCategoryName(item.subLabel, 'sub label')
    if (ids.has(item.id)) throw new Error('duplicate category id in catalog'); ids.add(item.id)
    const key = `${item.scheme}\0${item.mainLabel}\0${item.subLabel}`; if (names.has(key)) throw new Error('duplicate scheme/main/sub category in catalog'); names.add(key)
  }
  for (const mapping of parsed.mappings) {
    mapping.sourceLabel = validateSourceLabel(mapping.sourceLabel)
    const target = parsed.categories.find((item) => item.id === mapping.categoryId)
    if (!target || target.scheme !== mapping.scheme) throw new Error('mapping target is absent or belongs to a different scheme')
  }
  if (input.dryRun) { console.log(JSON.stringify({ dryRun: true, categories: parsed.categories.length, mappings: parsed.mappings.length, validation: 'PASS' })); return }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
  const digest = createHash('sha256').update(bytes).digest('hex')
  const result = await withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [DASHBOARD_WRITE_LOCK])
    if ((await client.query('SELECT sha256 FROM family_ledger.category_catalog_imports WHERE sha256=$1', [digest])).rowCount) {
      const snapshot = await client.query("SELECT name FROM family_ledger.dashboard_snapshots WHERE name='published'")
      if (!snapshot.rowCount) await publishDashboardSnapshot(client, parsed.actor)
      return { idempotent: true, categories: 0, mappings: 0 }
    }
    let categories = 0; let mappings = 0
    for (const item of parsed.categories) {
      const existing = await client.query<{ scheme: string; main_label: string; sub_label: string }>('SELECT scheme, main_label, sub_label FROM family_ledger.categories WHERE id=$1', [item.id])
      if (existing.rows[0]) {
        if (existing.rows[0].scheme !== item.scheme || existing.rows[0].main_label !== item.mainLabel || existing.rows[0].sub_label !== item.subLabel) throw new Error('catalog id conflicts with an existing managed category')
        continue
      }
      await client.query('INSERT INTO family_ledger.categories (id,scheme,main_label,sub_label,created_by) VALUES ($1,$2,$3,$4,$5)', [item.id,item.scheme,item.mainLabel,item.subLabel,parsed.actor]); categories++
      await client.query("INSERT INTO family_ledger.category_audit (scheme,operation,category_id,actor,after_state,affected_counts,evidence) VALUES ($1,'import',$2,$3,$4::jsonb,'{}'::jsonb,'{}'::jsonb)", [item.scheme,item.id,parsed.actor,JSON.stringify(item)])
    }
    for (const mapping of parsed.mappings) {
      const inserted = await client.query(
        `INSERT INTO family_ledger.category_rules (scheme,ledger_scope,source_label,category_id,status,evidence,created_by)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7) ON CONFLICT (scheme,ledger_scope,source_label) DO NOTHING RETURNING id`,
        [mapping.scheme,mapping.scope,mapping.sourceLabel,mapping.categoryId,mapping.status,JSON.stringify(mapping.evidence),parsed.actor])
      if (inserted.rowCount) mappings++
      if (inserted.rowCount) await client.query(
        `INSERT INTO family_ledger.category_audit (scheme,operation,category_id,actor,after_state,affected_counts,evidence)
         VALUES ($1,'import',$2,$3,$4::jsonb,'{}'::jsonb,$5::jsonb)`,
        [mapping.scheme,mapping.categoryId,parsed.actor,JSON.stringify({ scope: mapping.scope, sourceLabel: mapping.sourceLabel, status: mapping.status }),JSON.stringify(mapping.evidence)])
    }
    const changedSchemes = [...new Set([...parsed.categories.map((item) => item.scheme), ...parsed.mappings.map((item) => item.scheme)])]
    if (categories || mappings) await client.query('UPDATE family_ledger.classification_schemes SET revision=revision+1, updated_at=now() WHERE code=ANY($1::text[])', [changedSchemes])
    await client.query('INSERT INTO family_ledger.category_catalog_imports (sha256,source_label,imported_by) VALUES ($1,$2,$3)', [digest,basename(input.file),parsed.actor])
    await publishDashboardSnapshot(client, parsed.actor)
    return { idempotent: false, categories, mappings }
  })
  console.log(JSON.stringify(result))
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'category catalog import failed'); process.exitCode=1 }).finally(() => globalThis.familyLedgerPool?.end())
