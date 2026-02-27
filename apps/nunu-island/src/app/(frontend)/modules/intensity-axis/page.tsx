'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { EmotionIntensityAxis } from '@/components/EmotionIntensityAxis'
import { fetchEmotions } from '@/lib/content/fetch'
import { emotionIntensities } from '@/data/emotions'

export default function IntensityAxisModulePage() {
  const [intensities, setIntensities] = useState(emotionIntensities)

  useEffect(() => {
    let active = true

    const load = async () => {
      const data = await fetchEmotions()
      if (active) {
        setIntensities(data.intensities)
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [])

  return (
    <main className="min-h-screen gradient-warm px-6 py-8">
      <section className="mx-auto max-w-3xl space-y-4">
        <header className="rounded-3xl bg-white p-6 shadow-soft">
          <h1 className="text-2xl font-bold text-gray-900">情绪强度数轴</h1>
          <p className="mt-2 text-gray-600">先定位强度，再决定是记录、调节还是暂停。</p>
        </header>

        <div className="rounded-3xl bg-white p-6 shadow-soft">
          <EmotionIntensityAxis intensities={intensities} />
        </div>

        <Link href="/emotion-space" className="inline-flex rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700">
          返回情绪记录空间
        </Link>
      </section>
    </main>
  )
}
