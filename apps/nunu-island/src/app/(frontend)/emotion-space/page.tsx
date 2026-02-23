'use client'

import { useRouter } from 'next/navigation'
import { HomePage } from '@/sections/HomePage'
import { beliefs } from '@/data/beliefs'

export default function EmotionSpaceVersionPage() {
  const router = useRouter()

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
