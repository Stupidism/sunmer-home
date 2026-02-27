import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload/client'
import { defaultBeliefs } from '@/data/beliefs'
import type { Belief, BeliefMethod } from '@/types'

type PayloadBeliefDoc = {
  legacyId?: string | null
  order?: number | null
  oldBelief?: string | null
  newBelief?: string | null
  color?: string | null
  bgColor?: string | null
  theory?: Array<{ item?: string | null } | string> | null
  methods?: unknown
  dailyApplication?: Array<{ item?: string | null } | string> | null
}

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

function normalizeMethods(methods: unknown): BeliefMethod[] {
  if (!Array.isArray(methods)) return []

  return methods
    .map((method): BeliefMethod | null => {
      if (!method || typeof method !== 'object') return null
      const data = method as {
        id?: unknown
        title?: unknown
        description?: unknown
        steps?: unknown
      }

      if (typeof data.id !== 'string' || typeof data.title !== 'string' || typeof data.description !== 'string') {
        return null
      }

      const steps = Array.isArray(data.steps)
        ? data.steps.filter((step): step is string => typeof step === 'string')
        : []

      return {
        id: data.id,
        title: data.title,
        description: data.description,
        steps,
      }
    })
    .filter((method): method is BeliefMethod => Boolean(method))
}

function mapDocToBelief(doc: PayloadBeliefDoc): Belief | null {
  const id = doc.legacyId
  const order = doc.order
  const oldBelief = doc.oldBelief
  const newBelief = doc.newBelief
  const color = doc.color
  const bgColor = doc.bgColor

  if (
    !id ||
    typeof order !== 'number' ||
    !oldBelief ||
    !newBelief ||
    !color ||
    !bgColor
  ) {
    return null
  }

  return {
    id,
    order,
    oldBelief,
    newBelief,
    color,
    bgColor,
    theory: normalizeTextArray(doc.theory),
    methods: normalizeMethods(doc.methods),
    dailyApplication: normalizeTextArray(doc.dailyApplication),
  }
}

export async function GET() {
  try {
    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'beliefs',
      sort: 'order',
      limit: 100,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })

    const beliefs = result.docs
      .map((doc) => mapDocToBelief(doc as PayloadBeliefDoc))
      .filter((doc): doc is Belief => Boolean(doc))

    if (beliefs.length === 0) {
      return NextResponse.json({ beliefs: defaultBeliefs })
    }

    return NextResponse.json({ beliefs })
  } catch (error) {
    console.warn('Failed to load beliefs from Payload, fallback to defaults:', error)
    return NextResponse.json({ beliefs: defaultBeliefs })
  }
}
