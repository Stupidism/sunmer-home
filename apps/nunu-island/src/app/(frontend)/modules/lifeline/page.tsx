'use client'

import { useRouter } from 'next/navigation'
import { LifeLinePage } from '@/sections/LifeLinePage'

export default function LifelineModulePage() {
  const router = useRouter()
  return <LifeLinePage onBack={() => router.push('/emotion-space')} />
}
