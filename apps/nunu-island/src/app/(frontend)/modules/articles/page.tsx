'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArticlesPage } from '@/sections/ArticlesPage'
import { defaultArticles } from '@/data/articles'
import type { Article } from '@/types'

export default function ArticlesModulePage() {
  const router = useRouter()
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

  return (
    <ArticlesPage
      articles={articles}
      onBack={() => router.push('/emotion-space')}
      onSelectArticle={(articleId) => router.push(`/modules/articles/${articleId}`)}
    />
  )
}
