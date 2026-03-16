import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload/client'

type MediaType = 'image' | 'video' | 'audio'

type MediaItem = {
  id: string
  type: MediaType
  url: string
  caption?: string
}

type PayloadMediaDoc = {
  id?: number
  methodId?: string | null
  type?: MediaType | null
  url?: string | null
  caption?: string | null
  sortOrder?: number | null
}

function mapDocToMedia(doc: PayloadMediaDoc): (MediaItem & { sortOrder: number }) | null {
  if (!doc.id || !doc.type || !doc.url) return null

  return {
    id: String(doc.id),
    type: doc.type,
    url: doc.url,
    caption: doc.caption || undefined,
    sortOrder: typeof doc.sortOrder === 'number' ? doc.sortOrder : 0,
  }
}

async function listByMethodId(methodId: string): Promise<MediaItem[]> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'belief-method-media',
    where: {
      methodId: {
        equals: methodId,
      },
    },
    sort: 'sortOrder',
    limit: 200,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })

  return result.docs
    .map((doc) => mapDocToMedia(doc as PayloadMediaDoc))
    .filter((doc): doc is MediaItem & { sortOrder: number } => Boolean(doc))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => ({
      id: item.id,
      type: item.type,
      url: item.url,
      caption: item.caption,
    }))
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const methodId = url.searchParams.get('methodId')

    if (!methodId) {
      return NextResponse.json({ error: 'Missing methodId' }, { status: 400 })
    }

    const media = await listByMethodId(methodId)
    return NextResponse.json({ media })
  } catch (error) {
    console.error('Failed to list belief method media:', error)
    return NextResponse.json({ media: [] })
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      methodId?: string
      type?: MediaType
      url?: string
      caption?: string
    }

    if (!body.methodId || !body.type || !body.url) {
      return NextResponse.json({ error: 'Invalid media payload' }, { status: 400 })
    }

    const payload = await getPayloadClient()
    const existing = await listByMethodId(body.methodId)

    await payload.create({
      collection: 'belief-method-media',
      data: {
        methodId: body.methodId,
        type: body.type,
        url: body.url,
        caption: body.caption || null,
        sortOrder: existing.length,
      },
      overrideAccess: true,
    })

    const media = await listByMethodId(body.methodId)
    return NextResponse.json({ media })
  } catch (error) {
    console.error('Failed to create belief method media:', error)
    return NextResponse.json({ error: 'Failed to create belief method media' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const body = (await req.json()) as {
      methodId?: string
      mediaId?: string
    }

    if (!body.methodId || !body.mediaId) {
      return NextResponse.json({ error: 'Invalid delete payload' }, { status: 400 })
    }

    const payload = await getPayloadClient()
    await payload.delete({
      collection: 'belief-method-media',
      id: Number(body.mediaId),
      overrideAccess: true,
    })

    const media = await listByMethodId(body.methodId)
    return NextResponse.json({ media })
  } catch (error) {
    console.error('Failed to delete belief method media:', error)
    return NextResponse.json({ error: 'Failed to delete belief method media' }, { status: 500 })
  }
}
