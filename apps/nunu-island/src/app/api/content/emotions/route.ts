import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload/client'
import { emotionBranches, tools } from '@/data/emotionTree'
import { emotionCategories, emotionIndex, emotionIntensities } from '@/data/emotions'

type TextArrayField = Array<{ item?: string | null } | string> | null | undefined

type PayloadEmotionCategoryDoc = {
  legacyId?: string | null
  name?: string | null
  icon?: string | null
  color?: string | null
  bgColor?: string | null
  emotions?: unknown
}

type PayloadEmotionIntensityDoc = {
  legacyId?: string | null
  emotion?: string | null
  mild?: string | null
  moderate?: string | null
  severe?: string | null
  color?: string | null
}

type PayloadEmotionBranchDoc = {
  legacyId?: string | null
  name?: string | null
  icon?: string | null
  color?: string | null
  bgColor?: string | null
  description?: string | null
  leaves?: unknown
  recommendedTools?: TextArrayField
}

type PayloadEmotionToolDoc = {
  legacyId?: string | null
  name?: string | null
  icon?: string | null
  duration?: string | null
  description?: string | null
  forEmotions?: TextArrayField
  color?: string | null
  type?: string | null
  steps?: TextArrayField
}

type EmotionCategoryMapped = {
  id: string
  name: string
  icon: string
  color: string
  bgColor: string
  emotions: Array<{ name?: string; scenario?: string }>
}

type EmotionIntensityMapped = {
  id: string
  emotion: string
  mild: string
  moderate: string
  severe: string
  color: string
}

type EmotionBranchMapped = {
  id: string
  name: string
  icon: string
  color: string
  bgColor: string
  description: string
  leaves: unknown[]
  recommendedTools: string[]
}

type EmotionToolMapped = {
  id: string
  name: string
  icon: string
  duration: string
  description: string
  forEmotions: string[]
  color: string
  type: string
  steps: string[]
}

function notNull<T>(value: T | null): value is T {
  return value !== null
}

function normalizeTextArray(items: TextArrayField): string[] {
  if (!Array.isArray(items)) return []
  return items
    .map((item) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object' && 'item' in item && typeof item.item === 'string') {
        return item.item
      }
      return ''
    })
    .filter(Boolean)
}

function mapCategory(doc: PayloadEmotionCategoryDoc): EmotionCategoryMapped | null {
  if (!doc.legacyId || !doc.name || !doc.icon || !doc.color || !doc.bgColor || !Array.isArray(doc.emotions)) {
    return null
  }

  return {
    id: doc.legacyId,
    name: doc.name,
    icon: doc.icon,
    color: doc.color,
    bgColor: doc.bgColor,
    emotions: doc.emotions as Array<{ name?: string; scenario?: string }>,
  }
}

function mapIntensity(doc: PayloadEmotionIntensityDoc): EmotionIntensityMapped | null {
  if (!doc.legacyId || !doc.emotion || !doc.mild || !doc.moderate || !doc.severe || !doc.color) {
    return null
  }

  return {
    id: doc.legacyId,
    emotion: doc.emotion,
    mild: doc.mild,
    moderate: doc.moderate,
    severe: doc.severe,
    color: doc.color,
  }
}

function mapBranch(doc: PayloadEmotionBranchDoc): EmotionBranchMapped | null {
  if (
    !doc.legacyId ||
    !doc.name ||
    !doc.icon ||
    !doc.color ||
    !doc.bgColor ||
    !doc.description ||
    !Array.isArray(doc.leaves)
  ) {
    return null
  }

  return {
    id: doc.legacyId,
    name: doc.name,
    icon: doc.icon,
    color: doc.color,
    bgColor: doc.bgColor,
    description: doc.description,
    leaves: doc.leaves as unknown[],
    recommendedTools: normalizeTextArray(doc.recommendedTools),
  }
}

function mapTool(doc: PayloadEmotionToolDoc): EmotionToolMapped | null {
  if (!doc.legacyId || !doc.name || !doc.icon || !doc.duration || !doc.description || !doc.color || !doc.type) {
    return null
  }

  return {
    id: doc.legacyId,
    name: doc.name,
    icon: doc.icon,
    duration: doc.duration,
    description: doc.description,
    forEmotions: normalizeTextArray(doc.forEmotions),
    color: doc.color,
    type: doc.type,
    steps: normalizeTextArray(doc.steps),
  }
}

export async function GET() {
  try {
    const payload = await getPayloadClient()

    const [categoryResult, intensityResult, branchResult, toolResult] = await Promise.all([
      payload.find({
        collection: 'emotion-categories',
        sort: 'name',
        limit: 200,
        pagination: false,
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'emotion-intensities',
        sort: 'emotion',
        limit: 200,
        pagination: false,
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'emotion-branches',
        sort: 'name',
        limit: 200,
        pagination: false,
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'emotion-tools',
        sort: 'name',
        limit: 500,
        pagination: false,
        depth: 0,
        overrideAccess: true,
      }),
    ])

    const categories = categoryResult.docs
      .map((doc) => mapCategory(doc as PayloadEmotionCategoryDoc))
      .filter(notNull)
    const intensities = intensityResult.docs
      .map((doc) => mapIntensity(doc as PayloadEmotionIntensityDoc))
      .filter(notNull)
    const branches = branchResult.docs
      .map((doc) => mapBranch(doc as PayloadEmotionBranchDoc))
      .filter(notNull)
    const emotionTools = toolResult.docs
      .map((doc) => mapTool(doc as PayloadEmotionToolDoc))
      .filter(notNull)

    if (categories.length === 0 || intensities.length === 0 || branches.length === 0 || emotionTools.length === 0) {
      return NextResponse.json({
        categories: emotionCategories,
        index: emotionIndex,
        intensities: emotionIntensities,
        branches: emotionBranches,
        tools,
      })
    }

    const index = categories
      .flatMap((category) =>
        category.emotions.map((emotion) => ({
          name: emotion.name || '',
          category: category.name,
          scenario: emotion.scenario || '',
          color: category.color,
        }))
      )
      .filter((item) => item.name)
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))

    return NextResponse.json({
      categories,
      index,
      intensities,
      branches,
      tools: emotionTools,
    })
  } catch (error) {
    console.warn('Failed to load emotions from Payload, fallback to defaults:', error)
    return NextResponse.json({
      categories: emotionCategories,
      index: emotionIndex,
      intensities: emotionIntensities,
      branches: emotionBranches,
      tools,
    })
  }
}
