import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload/client'
import { mindfulnessHabits, mindfulnessScenarios } from '@/data/mindfulness'

type TextArrayField = Array<{ item?: string | null } | string> | null | undefined

type PayloadScenarioDoc = {
  legacyId?: string | null
  title?: string | null
  icon?: string | null
  color?: string | null
  situation?: string | null
  cycle?: string | null
  steps?: unknown
  questions?: TextArrayField
}

type PayloadHabitDoc = {
  legacyId?: string | null
  title?: string | null
  description?: string | null
  examples?: TextArrayField
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

function mapScenario(doc: PayloadScenarioDoc) {
  if (
    !doc.legacyId ||
    !doc.title ||
    !doc.icon ||
    !doc.color ||
    !doc.situation ||
    !doc.cycle ||
    !Array.isArray(doc.steps)
  ) {
    return null
  }

  return {
    id: doc.legacyId,
    title: doc.title,
    icon: doc.icon,
    color: doc.color,
    situation: doc.situation,
    cycle: doc.cycle,
    steps: doc.steps,
    questions: normalizeTextArray(doc.questions),
  }
}

function mapHabit(doc: PayloadHabitDoc) {
  if (!doc.legacyId || !doc.title || !doc.description) {
    return null
  }

  return {
    id: doc.legacyId,
    title: doc.title,
    description: doc.description,
    examples: normalizeTextArray(doc.examples),
  }
}

export async function GET() {
  try {
    const payload = await getPayloadClient()

    const [scenarioResult, habitResult] = await Promise.all([
      payload.find({
        collection: 'mindfulness-scenarios',
        sort: 'title',
        limit: 300,
        pagination: false,
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'mindfulness-habits',
        sort: 'title',
        limit: 300,
        pagination: false,
        depth: 0,
        overrideAccess: true,
      }),
    ])

    const scenarios = scenarioResult.docs.map((doc) => mapScenario(doc as PayloadScenarioDoc)).filter(Boolean)
    const habits = habitResult.docs.map((doc) => mapHabit(doc as PayloadHabitDoc)).filter(Boolean)

    if (scenarios.length === 0 || habits.length === 0) {
      return NextResponse.json({
        scenarios: mindfulnessScenarios,
        habits: mindfulnessHabits,
      })
    }

    return NextResponse.json({
      scenarios,
      habits,
    })
  } catch (error) {
    console.warn('Failed to load mindfulness content from Payload, fallback to defaults:', error)
    return NextResponse.json({
      scenarios: mindfulnessScenarios,
      habits: mindfulnessHabits,
    })
  }
}
