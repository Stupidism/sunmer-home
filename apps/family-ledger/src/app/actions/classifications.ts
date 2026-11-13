'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getSessionUser } from '@/server/auth'
import {
  assignTransactionClassification, bulkMapSourceLabel, createCategory, mergeCategories, previewBulkMap, previewMerge,
  previewRename, previewSplit, previewTransactionAssignment, renameCategory, splitCategory, type ClassificationPreview,
} from '@/server/classification-management'

const scheme = z.enum(['GB', 'QS', 'ZFB'])
const scope = z.enum(['household','company','agency','funding','foreignHousehold','income','pendingIncome','excludedIncome'])
const id = z.string().trim().min(3).max(100)
const revision = z.number().int().positive().safe()
const evidence = z.record(z.string(), z.unknown()).default({})
const amount = z.object({ currency: z.string().regex(/^[A-Z]{3}$/), count: z.number().int().nonnegative(), cents: z.number().int().safe() })
const previewSchema = z.object({
  operation: z.enum(['rename','merge','split','map','assign']), scheme, scope: scope.optional(), sourceCategoryId: id.optional(),
  destinationCategoryId: id.optional(), sourceLabel: z.string().min(1).max(200).optional(), expectedRevision: revision,
  expectedDestinationRevision: revision.optional(),
  transactionIds: z.array(z.string().min(1).max(300)).max(10000), affected: z.array(amount),
})

async function actor(): Promise<string> {
  const user = await getSessionUser()
  if (!user || user.role !== 'admin') throw new Error('not authorized')
  return user.username
}
function ok<T>(value: T) { return { ok: true as const, value } }
function failed(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (/not authorized/i.test(message)) return { ok: false as const, error: 'not authorized' }
  if (/revision|stale/i.test(message)) return { ok: false as const, error: 'classification preview is stale' }
  if (/already exists|duplicate|unique/i.test(message)) return { ok: false as const, error: 'category already exists' }
  if (/does not exist|missing|different scheme|archived|merged|invalid|requires|must |outside|no change|differ|itself/i.test(message)) return { ok: false as const, error: message }
  return { ok: false as const, error: 'classification operation failed' }
}
async function run<T>(callback: () => Promise<T>) { try { await actor(); return ok(await callback()) } catch (error) { return failed(error) } }
async function mutate<T>(callback: (username: string) => Promise<T>) {
  try { const username = await actor(); const value = await callback(username); revalidatePath('/'); return ok(value) } catch (error) { return failed(error) }
}

export async function createCategoryAction(input: unknown) {
  return mutate((username) => createCategory(z.object({ scheme, mainLabel: z.string(), subLabel: z.string(), id: id.optional() }).parse(input), username))
}
export async function previewRenameCategoryAction(input: unknown) {
  return run(() => previewRename(z.object({ categoryId: id, expectedRevision: revision }).parse(input)))
}
export async function renameCategoryAction(input: unknown) {
  return mutate((username) => { const parsed = z.object({ preview: previewSchema, mainLabel: z.string(), subLabel: z.string() }).parse(input); return renameCategory(parsed.preview as ClassificationPreview, parsed, username) })
}
export async function previewMergeCategoriesAction(input: unknown) {
  return run(() => previewMerge(z.object({ sourceCategoryId: id, destinationCategoryId: id, expectedRevision: revision }).parse(input)))
}
export async function mergeCategoriesAction(input: unknown) {
  return mutate((username) => mergeCategories(previewSchema.parse(input) as ClassificationPreview, username))
}
export async function previewSplitCategoryAction(input: unknown) {
  return run(() => previewSplit(z.object({ sourceCategoryId: id, destinationCategoryId: id, scope, transactionIds: z.array(z.string().min(1).max(300)).min(1).max(10000), expectedRevision: revision }).parse(input)))
}
export async function splitCategoryAction(input: unknown) {
  return mutate((username) => { const parsed = z.object({ preview: previewSchema, evidence }).parse(input); return splitCategory(parsed.preview as ClassificationPreview, username, parsed.evidence) })
}
export async function previewBulkMapSourceLabelAction(input: unknown) {
  return run(() => previewBulkMap(z.object({ scheme, scope, sourceLabel: z.string(), destinationCategoryId: id, expectedRevision: revision }).parse(input)))
}
export async function bulkMapSourceLabelAction(input: unknown) {
  return mutate((username) => { const parsed = z.object({ preview: previewSchema, status: z.enum(['inferred','confirmed']), evidence }).parse(input); return bulkMapSourceLabel(parsed.preview as ClassificationPreview, username, parsed.status, parsed.evidence) })
}
export async function previewTransactionClassificationAction(input: unknown) {
  return run(() => previewTransactionAssignment(z.object({ scheme, transactionId: z.string().min(1).max(300), destinationCategoryId: id, expectedRevision: revision }).parse(input)))
}
export async function assignTransactionClassificationAction(input: unknown) {
  return mutate((username) => { const parsed = z.object({ preview: previewSchema, evidence }).parse(input); return assignTransactionClassification(parsed.preview as ClassificationPreview, username, parsed.evidence) })
}
