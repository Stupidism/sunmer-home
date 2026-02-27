'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { HomePage } from '@/sections/HomePage'
import { defaultBeliefs } from '@/data/beliefs'
import { fetchBeliefs } from '@/lib/content/fetch'
import type { Belief } from '@/types'

export default function EmotionSpaceVersionPage() {
  const router = useRouter()
  const [beliefs, setBeliefs] = useState<Belief[]>(defaultBeliefs)

  useEffect(() => {
    let active = true

    const load = async () => {
      const nextBeliefs = await fetchBeliefs()
      if (active) {
        setBeliefs(nextBeliefs)
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [])

  return (
    <HomePage
      beliefs={beliefs}
      onSelectTemplate={(templateId) => router.push(`/modules/template-selector#${templateId}`)}
      onViewHistory={() => router.push('/modules/lifeline')}
      onViewArticles={() => router.push('/modules/articles')}
      onViewLifeLine={() => router.push('/modules/lifeline')}
      onViewMindfulness={() => router.push('/modules/mindfulness')}
      onSelectBelief={(beliefId) => router.push(`/modules/beliefs/${beliefId}`)}
      onRecordSuccess={() => router.push('/modules/beliefs')}
      recordCount={0}
    />
  )
}
