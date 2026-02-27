'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { BeliefDetailPage } from '@/sections/BeliefDetailPage'
import { defaultBeliefs } from '@/data/beliefs'
import { fetchBeliefs } from '@/lib/content/fetch'
import type { Belief } from '@/types'

export default function BeliefDetailModulePage() {
  const params = useParams<{ id: string }>()
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

  const belief = useMemo(
    () => beliefs.find((item) => item.id === params.id) || beliefs[0],
    [beliefs, params.id]
  )

  return <BeliefDetailPage belief={belief} onBack={() => router.push('/modules/beliefs')} />
}
