'use client'

import { useRouter } from 'next/navigation'
import { MindfulnessPage } from '@/sections/MindfulnessPage'

export default function MindfulnessModulePage() {
  const router = useRouter()
  return <MindfulnessPage onBack={() => router.push('/emotion-space')} />
}
