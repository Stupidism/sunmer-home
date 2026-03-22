import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload/client'
import type { Answer } from '@/types'

type TemplateRecordDoc = {
  id?: number
  templateId?: string | null
  templateTitle?: string | null
  answers?: unknown
  createdAt?: string | null
}

type TemplateRecordWriteBody = {
  templateId?: string
  templateTitle?: string
  answers?: Answer[]
}

type TemplateRecordResponse = {
  id: string
  templateId: string
  templateTitle: string
  answers: Answer[]
  createdAt: string
}

function isAnswerValue(value: unknown): value is string | string[] | number {
  if (typeof value === 'string' || typeof value === 'number') return true
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isAnswerList(value: unknown): value is Answer[] {
  if (!Array.isArray(value)) return false

  return value.every(
    (item) =>
      Boolean(item) &&
      typeof item === 'object' &&
      'questionId' in item &&
      'value' in item &&
      typeof item.questionId === 'string' &&
      isAnswerValue(item.value)
  )
}

function isValidWriteBody(body: TemplateRecordWriteBody): body is Required<TemplateRecordWriteBody> {
  return Boolean(
    body &&
      typeof body.templateId === 'string' &&
      body.templateId.trim().length > 0 &&
      typeof body.templateTitle === 'string' &&
      body.templateTitle.trim().length > 0 &&
      isAnswerList(body.answers)
  )
}

function mapDocToRecord(doc: TemplateRecordDoc): TemplateRecordResponse | null {
  if (!doc.id || !doc.templateId || !doc.templateTitle || !isAnswerList(doc.answers)) {
    return null
  }

  return {
    id: String(doc.id),
    templateId: doc.templateId,
    templateTitle: doc.templateTitle,
    answers: doc.answers,
    createdAt: doc.createdAt || new Date().toISOString(),
  }
}

async function listRecords(templateId?: string) {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'template-records',
    where: templateId
      ? {
          templateId: {
            equals: templateId,
          },
        }
      : undefined,
    sort: '-createdAt',
    limit: 200,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })

  return result.docs
    .map((doc) => mapDocToRecord(doc as TemplateRecordDoc))
    .filter((doc): doc is TemplateRecordResponse => Boolean(doc))
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const templateId = url.searchParams.get('templateId')?.trim() || undefined
    const records = await listRecords(templateId)
    return NextResponse.json({ records })
  } catch (error) {
    console.error('Failed to list template records:', error)
    return NextResponse.json({ records: [] }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as TemplateRecordWriteBody
    if (!isValidWriteBody(body)) {
      return NextResponse.json({ error: 'Invalid template record payload' }, { status: 400 })
    }

    const payload = await getPayloadClient()
    const created = await payload.create({
      collection: 'template-records',
      data: {
        templateId: body.templateId,
        templateTitle: body.templateTitle,
        answers: body.answers,
      },
      overrideAccess: true,
    })

    const record = mapDocToRecord(created as TemplateRecordDoc)
    if (!record) {
      return NextResponse.json({ error: 'Failed to map template record' }, { status: 500 })
    }

    return NextResponse.json({ record })
  } catch (error) {
    console.error('Failed to create template record:', error)
    return NextResponse.json({ error: 'Failed to create template record' }, { status: 500 })
  }
}
