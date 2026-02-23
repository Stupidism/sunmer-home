import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload/client'
import { defaultArticles } from '@/data/articles'
import type { Article } from '@/types'

type PayloadArticleDoc = {
  legacyId?: string | null
  slug?: string | null
  title?: string | null
  subtitle?: string | null
  coverImage?: string | null
  tags?: unknown
  contentText?: string | null
  createdAt?: string | null
}

function mapDocToArticle(doc: PayloadArticleDoc): Article | null {
  const id = doc.legacyId || doc.slug
  const title = doc.title
  const coverImage = doc.coverImage || '/article-i-am-here.jpg'

  if (!id || !title) {
    return null
  }

  const tags = Array.isArray(doc.tags)
    ? doc.tags
        .map((item) => {
          if (typeof item === 'string') return item
          if (item && typeof item === 'object' && 'tag' in item && typeof item.tag === 'string') {
            return item.tag
          }
          return ''
        })
        .filter(Boolean)
    : []

  return {
    id,
    title,
    subtitle: doc.subtitle || undefined,
    coverImage,
    tags,
    content: (doc.contentText || '').split('\n'),
    createdAt: doc.createdAt || new Date().toISOString().slice(0, 10),
  }
}

export async function GET() {
  try {
    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'articles',
      sort: '-createdAt',
      limit: 100,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })

    const articles = result.docs
      .map((doc) => mapDocToArticle(doc as PayloadArticleDoc))
      .filter((doc): doc is Article => Boolean(doc))

    if (articles.length === 0) {
      return NextResponse.json({ articles: defaultArticles })
    }

    return NextResponse.json({ articles })
  } catch (error) {
    console.warn('Failed to load articles from Payload, fallback to defaults:', error)
    return NextResponse.json({ articles: defaultArticles })
  }
}
