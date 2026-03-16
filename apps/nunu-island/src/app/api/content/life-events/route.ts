import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload/client'
import { sampleLifeEvents } from '@/data/lifeLine'
import type { LifeEvent } from '@/data/lifeLine'

type PayloadLifeEventDoc = {
  id?: number
  legacyId?: string | null
  date?: string | null
  title?: string | null
  description?: string | null
  type?: 'positive' | 'negative' | null
  images?: Array<{ url?: string | null }> | null
  createdAt?: string | null
}

type LifeEventWriteBody = {
  id?: string
  date?: string
  title?: string
  description?: string
  type?: 'positive' | 'negative'
  images?: string[]
}

function mapDocToEvent(doc: PayloadLifeEventDoc): LifeEvent | null {
  if (!doc.legacyId || !doc.date || !doc.title || !doc.description || !doc.type) {
    return null
  }

  const images = Array.isArray(doc.images)
    ? doc.images
        .map((item) => (item && typeof item.url === 'string' ? item.url : ''))
        .filter(Boolean)
    : []

  return {
    id: doc.legacyId,
    date: doc.date,
    title: doc.title,
    description: doc.description,
    type: doc.type,
    images,
    createdAt: doc.createdAt || new Date().toISOString(),
  }
}

function isValidWriteBody(body: LifeEventWriteBody): body is Required<Omit<LifeEventWriteBody, 'id'>> {
  return Boolean(
    body &&
      typeof body.date === 'string' &&
      typeof body.title === 'string' &&
      typeof body.description === 'string' &&
      (body.type === 'positive' || body.type === 'negative') &&
      Array.isArray(body.images)
  )
}

async function listEvents() {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'life-events',
    sort: 'date',
    limit: 2000,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })

  const events = result.docs
    .map((doc) => mapDocToEvent(doc as PayloadLifeEventDoc))
    .filter((doc): doc is LifeEvent => Boolean(doc))

  return events
}

export async function GET() {
  try {
    const events = await listEvents()
    return NextResponse.json({ events })
  } catch (error) {
    console.warn('Failed to load life events from Payload, fallback to sample data:', error)
    return NextResponse.json({ events: sampleLifeEvents })
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as LifeEventWriteBody
    if (!isValidWriteBody(body)) {
      return NextResponse.json({ error: 'Invalid life event payload' }, { status: 400 })
    }

    const payload = await getPayloadClient()
    const legacyId = crypto.randomUUID()

    await payload.create({
      collection: 'life-events',
      data: {
        legacyId,
        date: body.date,
        title: body.title,
        description: body.description,
        type: body.type,
        images: body.images.map((url) => ({ url })),
      },
      overrideAccess: true,
    })

    const events = await listEvents()
    return NextResponse.json({ events })
  } catch (error) {
    console.error('Failed to create life event:', error)
    return NextResponse.json({ error: 'Failed to create life event' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as LifeEventWriteBody
    const eventId = body?.id
    if (!eventId || !isValidWriteBody(body)) {
      return NextResponse.json({ error: 'Invalid life event payload' }, { status: 400 })
    }

    const payload = await getPayloadClient()
    const found = await payload.find({
      collection: 'life-events',
      where: {
        legacyId: {
          equals: eventId,
        },
      },
      limit: 1,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })

    const target = found.docs[0] as PayloadLifeEventDoc | undefined
    if (!target?.id) {
      return NextResponse.json({ error: 'Life event not found' }, { status: 404 })
    }

    await payload.update({
      collection: 'life-events',
      id: target.id,
      data: {
        date: body.date,
        title: body.title,
        description: body.description,
        type: body.type,
        images: body.images.map((url) => ({ url })),
      },
      overrideAccess: true,
    })

    const events = await listEvents()
    return NextResponse.json({ events })
  } catch (error) {
    console.error('Failed to update life event:', error)
    return NextResponse.json({ error: 'Failed to update life event' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const body = (await req.json()) as { id?: string }
    if (!body?.id) {
      return NextResponse.json({ error: 'Missing life event id' }, { status: 400 })
    }

    const payload = await getPayloadClient()
    const found = await payload.find({
      collection: 'life-events',
      where: {
        legacyId: {
          equals: body.id,
        },
      },
      limit: 1,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })

    const target = found.docs[0] as PayloadLifeEventDoc | undefined
    if (!target?.id) {
      return NextResponse.json({ error: 'Life event not found' }, { status: 404 })
    }

    await payload.delete({
      collection: 'life-events',
      id: target.id,
      overrideAccess: true,
    })

    const events = await listEvents()
    return NextResponse.json({ events })
  } catch (error) {
    console.error('Failed to delete life event:', error)
    return NextResponse.json({ error: 'Failed to delete life event' }, { status: 500 })
  }
}
