import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload/client'
import { babyRelationshipTemplate, otherTemplates } from '@/data/babyRelationshipTemplate'
import type { Template } from '@/types'

type PayloadTemplateDoc = {
  legacyId?: string | null
  title?: string | null
  description?: string | null
  icon?: string | null
  color?: string | null
  bgColor?: string | null
  questionCount?: number | null
  scenarios?: Array<{ item?: string | null } | string> | null
  layers?: unknown
}

const orderedTemplateIds = ['gratitude-journal', 'love-ability', 'baby-relationship', 'self-attribution', 'ifs']

const defaultTemplates = [
  ...otherTemplates.filter((t) => t.id === 'gratitude-journal'),
  ...otherTemplates.filter((t) => t.id === 'love-ability'),
  babyRelationshipTemplate,
  ...otherTemplates.filter((t) => t.id === 'self-attribution'),
  ...otherTemplates.filter((t) => t.id === 'ifs'),
]

function normalizeTextArray(items: Array<{ item?: string | null } | string> | null | undefined): string[] {
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

function mapDocToTemplate(doc: PayloadTemplateDoc): Template | null {
  const id = doc.legacyId
  const title = doc.title
  const description = doc.description
  const icon = doc.icon
  const color = doc.color
  const bgColor = doc.bgColor
  const questionCount = doc.questionCount

  if (!id || !title || !description || !icon || !color || !bgColor || typeof questionCount !== 'number') {
    return null
  }

  const template: Template = {
    id,
    title,
    description,
    icon,
    color,
    bgColor,
    questionCount,
  }

  if (Array.isArray(doc.layers)) {
    template.layers = doc.layers as Template['layers']
  }

  const scenarios = normalizeTextArray(doc.scenarios)
  if (scenarios.length > 0) {
    ;(template as Template & { scenarios?: string[] }).scenarios = scenarios
  }

  return template
}

function sortByExpectedOrder(templates: Template[]): Template[] {
  const rank = new Map(orderedTemplateIds.map((id, index) => [id, index]))

  return [...templates].sort((a, b) => {
    const left = rank.get(a.id)
    const right = rank.get(b.id)

    if (typeof left === 'number' && typeof right === 'number') return left - right
    if (typeof left === 'number') return -1
    if (typeof right === 'number') return 1
    return a.title.localeCompare(b.title, 'zh-CN')
  })
}

export async function GET() {
  try {
    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'templates',
      sort: 'title',
      limit: 200,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })

    const templates = sortByExpectedOrder(
      result.docs
        .map((doc) => mapDocToTemplate(doc as PayloadTemplateDoc))
        .filter((doc): doc is Template => Boolean(doc))
    )

    if (templates.length === 0) {
      return NextResponse.json({ templates: defaultTemplates })
    }

    return NextResponse.json({ templates })
  } catch (error) {
    console.warn('Failed to load templates from Payload, fallback to defaults:', error)
    return NextResponse.json({ templates: defaultTemplates })
  }
}
