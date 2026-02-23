'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArticleDetailPage } from '@/sections/ArticleDetailPage'
import { defaultArticles } from '@/data/articles'
import type { Article } from '@/types'

export default function ArticleDetailModulePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const articleId = params.id
  const [articles, setArticles] = useState<Article[]>(defaultArticles)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const response = await fetch('/api/content/articles', { cache: 'no-store' })
        const data = (await response.json().catch(() => ({}))) as { articles?: Article[] }
        if (response.ok && Array.isArray(data.articles) && data.articles.length > 0 && active) {
          setArticles(data.articles)
        }
      } catch {
        // fallback to defaults
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [])

  const article = useMemo(() => articles.find((item) => item.id === articleId) || defaultArticles[0], [articleId, articles])

  return <ArticleDetailPage article={article} onBack={() => router.push('/modules/articles')} />
}
