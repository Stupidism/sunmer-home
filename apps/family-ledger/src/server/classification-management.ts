import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import { assertRevision, validateCategoryName, validateSourceLabel } from '@/lib/domain/classification'
import type { CategoryDefinition, ClassificationScheme, LedgerScope } from '@/lib/domain/types'
import { withTransaction } from './db/pool'
import { DASHBOARD_WRITE_LOCK, publishDashboardSnapshot, type QueryClient } from './repository'

export interface ChangeAmounts { currency: string; count: number; cents: number }
export interface ClassificationPreview {
  operation: 'rename' | 'merge' | 'split' | 'map' | 'assign'
  scheme: ClassificationScheme
  scope?: LedgerScope
  sourceCategoryId?: string
  destinationCategoryId?: string
  sourceLabel?: string
  expectedRevision: number
  expectedDestinationRevision?: number
  transactionIds: string[]
  affected: ChangeAmounts[]
}

type CategoryRow = {
  id: string; scheme: ClassificationScheme; main_label: string; sub_label: string
  state: CategoryDefinition['state']; merged_into_id: string | null; revision: string
}

function definition(row: CategoryRow): CategoryDefinition {
  return { id: row.id, scheme: row.scheme, mainLabel: row.main_label, subLabel: row.sub_label,
    state: row.state, ...(row.merged_into_id ? { mergedIntoId: row.merged_into_id } : {}), revision: Number(row.revision) }
}

async function category(db: QueryClient, id: string, lock = false): Promise<CategoryDefinition> {
  const result = await db.query<CategoryRow>(
    `SELECT id, scheme, main_label, sub_label, state, merged_into_id, revision::text
     FROM family_ledger.categories WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [id])
  if (!result.rows[0]) throw new Error('category does not exist')
  return definition(result.rows[0])
}

function requireActiveTarget(value: CategoryDefinition, scheme: ClassificationScheme): void {
  if (value.scheme !== scheme) throw new Error('category belongs to a different scheme')
  if (value.state !== 'active') throw new Error('archived or merged categories cannot be new targets')
}

async function amounts(db: QueryClient, where: string, parameters: unknown[]): Promise<ChangeAmounts[]> {
  const result = await db.query<{ currency: string; count: string; cents: string }>(
    `SELECT t.currency, count(*)::text AS count, sum(t.cents)::text AS cents
     FROM family_ledger.transactions t ${where} GROUP BY t.currency ORDER BY t.currency`, parameters)
  return result.rows.map((row) => ({ currency: row.currency, count: Number(row.count), cents: Number(row.cents) }))
}

function samePreview(left: ClassificationPreview, right: ClassificationPreview): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

async function write<T>(actor: string, callback: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  return withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [DASHBOARD_WRITE_LOCK])
    const result = await callback(client)
    await publishDashboardSnapshot(client, actor)
    return result
  })
}

export async function createCategory(input: { scheme: ClassificationScheme; mainLabel: string; subLabel: string; id?: string }, actor: string): Promise<CategoryDefinition> {
  const mainLabel = validateCategoryName(input.mainLabel, 'main label')
  const subLabel = validateCategoryName(input.subLabel, 'sub label')
  const id = input.id ?? `${input.scheme.toLowerCase()}:${randomUUID()}`
  return write(actor, async (client) => {
    const result = await client.query<CategoryRow>(
      `INSERT INTO family_ledger.categories (id, scheme, main_label, sub_label, created_by)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, scheme, main_label, sub_label, state, merged_into_id, revision::text`,
      [id, input.scheme, mainLabel, subLabel, actor])
    await bumpScheme(client, input.scheme)
    await audit(client, input.scheme, 'create', id, actor, null, result.rows[0], {})
    return definition(result.rows[0]!)
  })
}

export async function previewRename(input: { categoryId: string; expectedRevision: number }): Promise<ClassificationPreview> {
  const source = await category((await import('./db/pool')).getPool(), input.categoryId)
  assertRevision(source.revision, input.expectedRevision)
  requireActiveTarget(source, source.scheme)
  return { operation: 'rename', scheme: source.scheme, sourceCategoryId: source.id, expectedRevision: source.revision,
    transactionIds: [], affected: await effectiveAmounts((await import('./db/pool')).getPool(), source.scheme, source.id) }
}

export async function renameCategory(preview: ClassificationPreview, labels: { mainLabel: string; subLabel: string }, actor: string): Promise<CategoryDefinition> {
  const mainLabel = validateCategoryName(labels.mainLabel, 'main label')
  const subLabel = validateCategoryName(labels.subLabel, 'sub label')
  return write(actor, async (client) => {
    if (preview.operation !== 'rename' || !preview.sourceCategoryId) throw new Error('invalid rename preview')
    const current = await category(client, preview.sourceCategoryId, true)
    const actual = await previewRenameWith(client, current)
    if (!samePreview(preview, actual)) throw new Error('classification preview is stale')
    if (current.mainLabel === mainLabel && current.subLabel === subLabel) throw new Error('rename must change a label')
    const result = await client.query<CategoryRow>(
      `UPDATE family_ledger.categories SET main_label=$2, sub_label=$3, revision=revision+1, updated_at=now()
       WHERE id=$1 RETURNING id, scheme, main_label, sub_label, state, merged_into_id, revision::text`,
      [current.id, mainLabel, subLabel])
    await bumpScheme(client, current.scheme)
    await audit(client, current.scheme, 'rename', current.id, actor, current, definition(result.rows[0]!), affectedObject(actual))
    return definition(result.rows[0]!)
  })
}

export async function previewMerge(input: { sourceCategoryId: string; destinationCategoryId: string; expectedRevision: number }, db?: QueryClient): Promise<ClassificationPreview> {
  const query = db ?? (await import('./db/pool')).getPool()
  const source = await category(query, input.sourceCategoryId)
  const destination = await category(query, input.destinationCategoryId)
  assertRevision(source.revision, input.expectedRevision)
  if (source.id === destination.id) throw new Error('cannot merge a category into itself')
  requireActiveTarget(source, source.scheme); requireActiveTarget(destination, source.scheme)
  return { operation: 'merge', scheme: source.scheme, sourceCategoryId: source.id, destinationCategoryId: destination.id,
    expectedRevision: source.revision, expectedDestinationRevision: destination.revision, transactionIds: [], affected: await effectiveAmounts(query, source.scheme, source.id) }
}

export async function mergeCategories(preview: ClassificationPreview, actor: string): Promise<void> {
  await write(actor, async (client) => {
    if (preview.operation !== 'merge' || !preview.sourceCategoryId || !preview.destinationCategoryId) throw new Error('invalid merge preview')
    await category(client, preview.sourceCategoryId, true); await category(client, preview.destinationCategoryId, true)
    const actual = await previewMerge({ sourceCategoryId: preview.sourceCategoryId, destinationCategoryId: preview.destinationCategoryId, expectedRevision: preview.expectedRevision }, client)
    if (!samePreview(preview, actual)) throw new Error('classification preview is stale')
    await client.query('UPDATE family_ledger.category_rules SET category_id=$2, revision=revision+1, updated_at=now() WHERE category_id=$1', [preview.sourceCategoryId, preview.destinationCategoryId])
    await client.query('UPDATE family_ledger.transaction_classifications SET category_id=$2, revision=revision+1, assigned_at=now() WHERE category_id=$1', [preview.sourceCategoryId, preview.destinationCategoryId])
    await client.query("UPDATE family_ledger.categories SET state='merged', merged_into_id=$2, revision=revision+1, updated_at=now() WHERE id=$1", [preview.sourceCategoryId, preview.destinationCategoryId])
    await bumpScheme(client, preview.scheme)
    await audit(client, preview.scheme, 'merge', preview.sourceCategoryId, actor, { id: preview.sourceCategoryId }, { mergedIntoId: preview.destinationCategoryId }, affectedObject(actual))
  })
}

export async function previewSplit(input: { sourceCategoryId: string; destinationCategoryId: string; scope: LedgerScope; transactionIds: string[]; expectedRevision: number }, db?: QueryClient): Promise<ClassificationPreview> {
  const query = db ?? (await import('./db/pool')).getPool()
  const source = await category(query, input.sourceCategoryId); const destination = await category(query, input.destinationCategoryId)
  assertRevision(source.revision, input.expectedRevision); requireActiveTarget(source, source.scheme); requireActiveTarget(destination, source.scheme)
  if (source.id === destination.id) throw new Error('split destination must differ from source')
  const ids = [...new Set(input.transactionIds)]
  if (!ids.length || ids.length !== input.transactionIds.length) throw new Error('split requires unique explicit transaction ids')
  const affected = await effectiveAmounts(query, source.scheme, source.id, input.scope, ids)
  if (affected.reduce((n, item) => n + item.count, 0) !== ids.length) throw new Error('split contains transactions outside the source category or scope')
  return { operation: 'split', scheme: source.scheme, scope: input.scope, sourceCategoryId: source.id, destinationCategoryId: destination.id,
    expectedRevision: source.revision, expectedDestinationRevision: destination.revision, transactionIds: [...ids].sort(), affected }
}

export async function splitCategory(preview: ClassificationPreview, actor: string, evidence: Record<string, unknown>): Promise<void> {
  await write(actor, async (client) => {
    if (preview.operation !== 'split' || !preview.sourceCategoryId || !preview.destinationCategoryId || !preview.scope) throw new Error('invalid split preview')
    await category(client, preview.sourceCategoryId, true); await category(client, preview.destinationCategoryId, true)
    const actual = await previewSplit({ sourceCategoryId: preview.sourceCategoryId, destinationCategoryId: preview.destinationCategoryId, scope: preview.scope, transactionIds: preview.transactionIds, expectedRevision: preview.expectedRevision }, client)
    if (!samePreview(preview, actual)) throw new Error('classification preview is stale')
    await client.query(
      `INSERT INTO family_ledger.transaction_classifications (transaction_id, scheme, category_id, status, evidence, assigned_by)
       SELECT unnest($1::text[]), $2, $3, 'override', $4::jsonb, $5
       ON CONFLICT (transaction_id, scheme) DO UPDATE SET category_id=EXCLUDED.category_id, status='override', evidence=EXCLUDED.evidence,
         revision=family_ledger.transaction_classifications.revision+1, assigned_by=EXCLUDED.assigned_by, assigned_at=now()`,
      [actual.transactionIds, actual.scheme, actual.destinationCategoryId, JSON.stringify(evidence), actor])
    await bumpCategoryAndScheme(client, actual.sourceCategoryId!, actual.scheme)
    await audit(client, actual.scheme, 'split', actual.sourceCategoryId, actor, null, { destinationCategoryId: actual.destinationCategoryId, transactionIds: actual.transactionIds }, affectedObject(actual), evidence)
  })
}

export async function previewBulkMap(input: { scheme: ClassificationScheme; scope: LedgerScope; sourceLabel: string; destinationCategoryId: string; expectedRevision: number }, db?: QueryClient): Promise<ClassificationPreview> {
  const query = db ?? (await import('./db/pool')).getPool(); const destination = await category(query, input.destinationCategoryId)
  requireActiveTarget(destination, input.scheme)
  const scheme = await query.query<{ revision: string }>('SELECT revision::text FROM family_ledger.classification_schemes WHERE code=$1', [input.scheme])
  if (!scheme.rows[0]) throw new Error('classification scheme does not exist')
  assertRevision(Number(scheme.rows[0].revision), input.expectedRevision)
  const sourceLabel = validateSourceLabel(input.sourceLabel)
  return { operation: 'map', scheme: input.scheme, scope: input.scope, sourceLabel, destinationCategoryId: destination.id,
    expectedRevision: Number(scheme.rows[0].revision), transactionIds: [],
    affected: await amounts(query, `LEFT JOIN family_ledger.transaction_classifications a ON a.transaction_id=t.stable_id AND a.scheme=$1
      WHERE t.scope=$2 AND COALESCE(t.raw->>'category','未分类')=$3 AND a.transaction_id IS NULL`, [input.scheme, input.scope, sourceLabel]) }
}

export async function bulkMapSourceLabel(preview: ClassificationPreview, actor: string, status: 'inferred' | 'confirmed', evidence: Record<string, unknown>): Promise<void> {
  await write(actor, async (client) => {
    if (preview.operation !== 'map' || !preview.scope || !preview.sourceLabel || !preview.destinationCategoryId) throw new Error('invalid map preview')
    const actual = await previewBulkMap({ scheme: preview.scheme, scope: preview.scope, sourceLabel: preview.sourceLabel, destinationCategoryId: preview.destinationCategoryId, expectedRevision: preview.expectedRevision }, client)
    if (!samePreview(preview, actual)) throw new Error('classification preview is stale')
    const unchanged = await client.query(
      `SELECT id FROM family_ledger.category_rules WHERE scheme=$1 AND ledger_scope=$2 AND source_label=$3
       AND category_id=$4 AND status=$5 AND evidence=$6::jsonb`,
      [actual.scheme,actual.scope,actual.sourceLabel,actual.destinationCategoryId,status,JSON.stringify(evidence)])
    if (unchanged.rowCount) throw new Error('mapping would make no change')
    await client.query(
      `INSERT INTO family_ledger.category_rules (scheme, ledger_scope, source_label, category_id, status, evidence, created_by)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)
       ON CONFLICT (scheme, ledger_scope, source_label) DO UPDATE SET category_id=EXCLUDED.category_id, status=EXCLUDED.status,
         evidence=EXCLUDED.evidence, revision=family_ledger.category_rules.revision+1, updated_at=now()`,
      [actual.scheme, actual.scope, actual.sourceLabel, actual.destinationCategoryId, status, JSON.stringify(evidence), actor])
    await bumpScheme(client, actual.scheme)
    await audit(client, actual.scheme, 'map', actual.destinationCategoryId, actor, null, { scope: actual.scope, sourceLabel: actual.sourceLabel, status }, affectedObject(actual), evidence)
  })
}

export async function previewTransactionAssignment(input: { scheme: ClassificationScheme; transactionId: string; destinationCategoryId: string; expectedRevision: number }, db?: QueryClient): Promise<ClassificationPreview> {
  const query = db ?? (await import('./db/pool')).getPool()
  const destination = await category(query, input.destinationCategoryId); requireActiveTarget(destination, input.scheme)
  const schemeRow = await query.query<{ revision: string }>('SELECT revision::text FROM family_ledger.classification_schemes WHERE code=$1', [input.scheme])
  if (!schemeRow.rows[0]) throw new Error('classification scheme does not exist')
  assertRevision(Number(schemeRow.rows[0].revision), input.expectedRevision)
  const affected = await amounts(query, 'WHERE t.stable_id=$1', [input.transactionId])
  if (affected.reduce((n, item) => n + item.count, 0) !== 1) throw new Error('transaction does not exist')
  return { operation: 'assign', scheme: input.scheme, destinationCategoryId: destination.id, expectedRevision: Number(schemeRow.rows[0].revision), transactionIds: [input.transactionId], affected }
}

export async function assignTransactionClassification(preview: ClassificationPreview, actor: string, evidence: Record<string, unknown>): Promise<void> {
  await write(actor, async (client) => {
    if (preview.operation !== 'assign' || !preview.destinationCategoryId || preview.transactionIds.length !== 1) throw new Error('invalid assignment preview')
    const actual = await previewTransactionAssignment({ scheme: preview.scheme, transactionId: preview.transactionIds[0]!, destinationCategoryId: preview.destinationCategoryId, expectedRevision: preview.expectedRevision }, client)
    if (!samePreview(preview, actual)) throw new Error('classification preview is stale')
    const unchanged = await client.query(
      `SELECT transaction_id FROM family_ledger.transaction_classifications
       WHERE transaction_id=$1 AND scheme=$2 AND category_id=$3 AND status='override' AND evidence=$4::jsonb`,
      [actual.transactionIds[0],actual.scheme,actual.destinationCategoryId,JSON.stringify(evidence)])
    if (unchanged.rowCount) throw new Error('assignment would make no change')
    await client.query(
      `INSERT INTO family_ledger.transaction_classifications (transaction_id,scheme,category_id,status,evidence,assigned_by)
       VALUES ($1,$2,$3,'override',$4::jsonb,$5)
       ON CONFLICT (transaction_id,scheme) DO UPDATE SET category_id=EXCLUDED.category_id,status='override',evidence=EXCLUDED.evidence,
         revision=family_ledger.transaction_classifications.revision+1,assigned_by=EXCLUDED.assigned_by,assigned_at=now()`,
      [actual.transactionIds[0],actual.scheme,actual.destinationCategoryId,JSON.stringify(evidence),actor])
    await bumpScheme(client, actual.scheme)
    await audit(client, actual.scheme, 'assign', actual.destinationCategoryId, actor, null, { transactionId: actual.transactionIds[0] }, affectedObject(actual), evidence)
  })
}

async function effectiveAmounts(db: QueryClient, scheme: ClassificationScheme, categoryId: string, scope?: LedgerScope, ids?: string[]): Promise<ChangeAmounts[]> {
  const clauses = [`COALESCE(a.category_id, r.category_id)=$2`]
  const params: unknown[] = [scheme, categoryId]
  if (scope) { params.push(scope); clauses.push(`t.scope=$${params.length}`) }
  if (ids) { params.push(ids); clauses.push(`t.stable_id=ANY($${params.length}::text[])`) }
  return amounts(db, `LEFT JOIN family_ledger.transaction_classifications a ON a.transaction_id=t.stable_id AND a.scheme=$1
    LEFT JOIN family_ledger.category_rules r ON r.scheme=$1 AND r.ledger_scope=t.scope AND r.source_label=COALESCE(t.raw->>'category','未分类')
    WHERE ${clauses.join(' AND ')}`, params)
}

async function previewRenameWith(db: QueryClient, current: CategoryDefinition): Promise<ClassificationPreview> {
  return { operation: 'rename', scheme: current.scheme, sourceCategoryId: current.id, expectedRevision: current.revision,
    transactionIds: [], affected: await effectiveAmounts(db, current.scheme, current.id) }
}
async function bumpScheme(db: QueryClient, scheme: ClassificationScheme) { await db.query('UPDATE family_ledger.classification_schemes SET revision=revision+1, updated_at=now() WHERE code=$1', [scheme]) }
async function bumpCategoryAndScheme(db: QueryClient, id: string, scheme: ClassificationScheme) { await db.query('UPDATE family_ledger.categories SET revision=revision+1, updated_at=now() WHERE id=$1', [id]); await bumpScheme(db, scheme) }
function affectedObject(preview: ClassificationPreview) { return { affected: preview.affected, transactionIds: preview.transactionIds } }
async function audit(db: QueryClient, scheme: ClassificationScheme, operation: string, categoryId: string | undefined, actor: string, before: unknown, after: unknown, affected: unknown, evidence: unknown = {}) {
  await db.query(`INSERT INTO family_ledger.category_audit (scheme, operation, category_id, actor, before_state, after_state, affected_counts, evidence)
    VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb)`, [scheme, operation, categoryId ?? null, actor, JSON.stringify(before), JSON.stringify(after), JSON.stringify(affected), JSON.stringify(evidence)])
}
