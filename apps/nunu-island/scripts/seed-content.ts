import configPromise from '@payload-config'
import { getPayload, type CollectionSlug } from 'payload'
import { defaultBeliefs } from '../src/data/beliefs'
import { babyRelationshipTemplate, otherTemplates } from '../src/data/babyRelationshipTemplate'
import { emotionBranches, tools } from '../src/data/emotionTree'
import { emotionCategories, emotionIntensities } from '../src/data/emotions'
import { mindfulnessHabits, mindfulnessScenarios } from '../src/data/mindfulness'

type UpsertInput = {
  collection: CollectionSlug
  legacyId: string
  data: Record<string, unknown>
}

const orderedTemplates = [
  ...otherTemplates.filter((t) => t.id === 'gratitude-journal'),
  ...otherTemplates.filter((t) => t.id === 'love-ability'),
  babyRelationshipTemplate,
  ...otherTemplates.filter((t) => t.id === 'self-attribution'),
  ...otherTemplates.filter((t) => t.id === 'ifs'),
]

async function upsertByLegacyId(payload: Awaited<ReturnType<typeof getPayload>>, input: UpsertInput) {
  const existing = await payload.find({
    collection: input.collection,
    where: {
      legacyId: {
        equals: input.legacyId,
      },
    },
    limit: 1,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })

  if (existing.docs.length > 0) {
    await payload.update({
      collection: input.collection,
      id: existing.docs[0].id,
      data: input.data,
      overrideAccess: true,
    })
    console.log(`updated: ${input.collection}:${input.legacyId}`)
    return
  }

  await payload.create({
    collection: input.collection,
    data: input.data,
    overrideAccess: true,
  })
  console.log(`created: ${input.collection}:${input.legacyId}`)
}

async function run() {
  const payload = await getPayload({ config: configPromise })

  for (const belief of defaultBeliefs) {
    await upsertByLegacyId(payload, {
      collection: 'beliefs',
      legacyId: belief.id,
      data: {
        legacyId: belief.id,
        order: belief.order,
        oldBelief: belief.oldBelief,
        newBelief: belief.newBelief,
        color: belief.color,
        bgColor: belief.bgColor,
        theory: belief.theory.map((item) => ({ item })),
        methods: belief.methods,
        dailyApplication: belief.dailyApplication.map((item) => ({ item })),
      },
    })
  }

  for (const template of orderedTemplates) {
    const withScenarios = template as typeof template & { scenarios?: string[] }
    await upsertByLegacyId(payload, {
      collection: 'templates',
      legacyId: template.id,
      data: {
        legacyId: template.id,
        title: template.title,
        description: template.description,
        icon: template.icon,
        color: template.color,
        bgColor: template.bgColor,
        questionCount: template.questionCount,
        scenarios: Array.isArray(withScenarios.scenarios)
          ? withScenarios.scenarios.map((item) => ({ item }))
          : [],
        layers: template.layers || null,
      },
    })
  }

  for (const category of emotionCategories) {
    await upsertByLegacyId(payload, {
      collection: 'emotion-categories',
      legacyId: category.id,
      data: {
        legacyId: category.id,
        name: category.name,
        icon: category.icon,
        color: category.color,
        bgColor: category.bgColor,
        emotions: category.emotions,
      },
    })
  }

  for (const intensity of emotionIntensities) {
    await upsertByLegacyId(payload, {
      collection: 'emotion-intensities',
      legacyId: intensity.emotion,
      data: {
        legacyId: intensity.emotion,
        emotion: intensity.emotion,
        mild: intensity.mild,
        moderate: intensity.moderate,
        severe: intensity.severe,
        color: intensity.color,
      },
    })
  }

  for (const branch of emotionBranches) {
    await upsertByLegacyId(payload, {
      collection: 'emotion-branches',
      legacyId: branch.id,
      data: {
        legacyId: branch.id,
        name: branch.name,
        icon: branch.icon,
        color: branch.color,
        bgColor: branch.bgColor,
        description: branch.description,
        leaves: branch.leaves,
        recommendedTools: branch.recommendedTools.map((item) => ({ item })),
      },
    })
  }

  for (const tool of tools) {
    await upsertByLegacyId(payload, {
      collection: 'emotion-tools',
      legacyId: tool.id,
      data: {
        legacyId: tool.id,
        name: tool.name,
        icon: tool.icon,
        duration: tool.duration,
        description: tool.description,
        forEmotions: tool.forEmotions.map((item) => ({ item })),
        color: tool.color,
        type: tool.type,
        steps: (tool.steps || []).map((item) => ({ item })),
      },
    })
  }

  for (const scenario of mindfulnessScenarios) {
    await upsertByLegacyId(payload, {
      collection: 'mindfulness-scenarios',
      legacyId: scenario.id,
      data: {
        legacyId: scenario.id,
        title: scenario.title,
        icon: scenario.icon,
        color: scenario.color,
        situation: scenario.situation,
        cycle: scenario.cycle,
        steps: scenario.steps,
        questions: (scenario.questions || []).map((item) => ({ item })),
      },
    })
  }

  for (const [index, habit] of mindfulnessHabits.entries()) {
    const legacyId = `habit-${index + 1}`
    await upsertByLegacyId(payload, {
      collection: 'mindfulness-habits',
      legacyId,
      data: {
        legacyId,
        title: habit.title,
        description: habit.description,
        examples: habit.examples.map((item) => ({ item })),
      },
    })
  }

  console.log('seed content completed')
}

void run().catch((error) => {
  console.error('seed content failed', error)
  process.exit(1)
})
