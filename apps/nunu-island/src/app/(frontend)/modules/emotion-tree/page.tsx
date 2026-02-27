'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { EmotionTreePage } from '@/sections/EmotionTreePage'
import { fetchEmotions } from '@/lib/content/fetch'
import { emotionBranches, tools } from '@/data/emotionTree'

export default function EmotionTreeModulePage() {
  const router = useRouter()
  const [branches, setBranches] = useState(emotionBranches)
  const [emotionTools, setEmotionTools] = useState(tools)

  useEffect(() => {
    let active = true

    const load = async () => {
      const data = await fetchEmotions()
      if (active) {
        setBranches(data.branches)
        setEmotionTools(data.tools)
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [])

  return (
    <EmotionTreePage
      branches={branches}
      emotionTools={emotionTools}
      onBack={() => router.push('/island')}
      onSelectTool={(toolId) => {
        if (toolId === 'ifs' || toolId === 'inner-child') {
          router.push('/modules/template-selector')
          return
        }
        if (toolId === 'journaling' || toolId === 'gratitude') {
          router.push('/modules/template-selector')
          return
        }
        router.push('/modules/mindfulness')
      }}
    />
  )
}
