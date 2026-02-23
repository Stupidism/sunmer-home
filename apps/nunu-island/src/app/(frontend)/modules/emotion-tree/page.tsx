'use client'

import { useRouter } from 'next/navigation'
import { EmotionTreePage } from '@/sections/EmotionTreePage'

export default function EmotionTreeModulePage() {
  const router = useRouter()

  return (
    <EmotionTreePage
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
