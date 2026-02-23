'use client'

import { useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { BeliefDetailPage } from '@/sections/BeliefDetailPage'
import { beliefs } from '@/data/beliefs'

export default function BeliefDetailModulePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()

  const belief = useMemo(() => beliefs.find((item) => item.id === params.id) || beliefs[0], [params.id])

  return <BeliefDetailPage belief={belief} onBack={() => router.push('/modules/beliefs')} />
}
