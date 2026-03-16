'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MindfulnessPage } from '@/sections/MindfulnessPage'
import { fetchMindfulness } from '@/lib/content/fetch'
import { mindfulnessHabits, mindfulnessScenarios } from '@/data/mindfulness'

export default function MindfulnessModulePage() {
  const router = useRouter()
  const [scenarios, setScenarios] = useState(mindfulnessScenarios)
  const [habits, setHabits] = useState(mindfulnessHabits)

  useEffect(() => {
    let active = true

    const load = async () => {
      const data = await fetchMindfulness()
      if (active) {
        setScenarios(data.scenarios)
        setHabits(data.habits)
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [])

  return <MindfulnessPage onBack={() => router.push('/emotion-space')} scenarios={scenarios} habits={habits} />
}
