import type { Belief, Template } from '@/types'
import type { LifeEvent } from '@/data/lifeLine'
import { defaultBeliefs } from '@/data/beliefs'
import { babyRelationshipTemplate, otherTemplates } from '@/data/babyRelationshipTemplate'
import { emotionBranches, tools } from '@/data/emotionTree'
import { emotionCategories, emotionIndex, emotionIntensities } from '@/data/emotions'
import { mindfulnessHabits, mindfulnessScenarios } from '@/data/mindfulness'

const defaultTemplates = [
  ...otherTemplates.filter((t) => t.id === 'gratitude-journal'),
  ...otherTemplates.filter((t) => t.id === 'love-ability'),
  babyRelationshipTemplate,
  ...otherTemplates.filter((t) => t.id === 'self-attribution'),
  ...otherTemplates.filter((t) => t.id === 'ifs'),
]

type EmotionContent = {
  categories: typeof emotionCategories
  index: typeof emotionIndex
  intensities: typeof emotionIntensities
  branches: typeof emotionBranches
  tools: typeof tools
}

type MindfulnessContent = {
  scenarios: typeof mindfulnessScenarios
  habits: typeof mindfulnessHabits
}

async function fetchJSON<T>(url: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(url, { cache: 'no-store' })
    const data = (await response.json().catch(() => null)) as T | null
    if (!response.ok || data == null) return fallback
    return data
  } catch {
    return fallback
  }
}

export async function fetchBeliefs(): Promise<Belief[]> {
  const data = await fetchJSON<{ beliefs?: Belief[] }>('/api/content/beliefs', {
    beliefs: defaultBeliefs,
  })
  return Array.isArray(data.beliefs) && data.beliefs.length > 0 ? data.beliefs : defaultBeliefs
}

export async function fetchTemplates(): Promise<Template[]> {
  const data = await fetchJSON<{ templates?: Template[] }>('/api/content/templates', {
    templates: defaultTemplates,
  })
  return Array.isArray(data.templates) && data.templates.length > 0 ? data.templates : defaultTemplates
}

export async function fetchEmotions(): Promise<EmotionContent> {
  const fallback: EmotionContent = {
    categories: emotionCategories,
    index: emotionIndex,
    intensities: emotionIntensities,
    branches: emotionBranches,
    tools,
  }

  const data = await fetchJSON<Partial<EmotionContent>>('/api/content/emotions', fallback)

  return {
    categories: Array.isArray(data.categories) && data.categories.length > 0 ? data.categories : fallback.categories,
    index: Array.isArray(data.index) && data.index.length > 0 ? data.index : fallback.index,
    intensities: Array.isArray(data.intensities) && data.intensities.length > 0 ? data.intensities : fallback.intensities,
    branches: Array.isArray(data.branches) && data.branches.length > 0 ? data.branches : fallback.branches,
    tools: Array.isArray(data.tools) && data.tools.length > 0 ? data.tools : fallback.tools,
  }
}

export async function fetchMindfulness(): Promise<MindfulnessContent> {
  const fallback: MindfulnessContent = {
    scenarios: mindfulnessScenarios,
    habits: mindfulnessHabits,
  }

  const data = await fetchJSON<Partial<MindfulnessContent>>('/api/content/mindfulness', fallback)

  return {
    scenarios: Array.isArray(data.scenarios) && data.scenarios.length > 0 ? data.scenarios : fallback.scenarios,
    habits: Array.isArray(data.habits) && data.habits.length > 0 ? data.habits : fallback.habits,
  }
}

export async function fetchLifeEvents(): Promise<LifeEvent[]> {
  const data = await fetchJSON<{ events?: LifeEvent[] }>('/api/content/life-events', {
    events: [],
  })
  return Array.isArray(data.events) ? data.events : []
}
