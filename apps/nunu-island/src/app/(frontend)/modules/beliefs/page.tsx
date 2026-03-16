'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { defaultBeliefs } from '@/data/beliefs'
import { fetchBeliefs } from '@/lib/content/fetch'
import type { Belief } from '@/types'

export default function BeliefsModulePage() {
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
    <main className="min-h-screen gradient-warm px-6 py-8">
      <section className="mx-auto max-w-4xl space-y-4">
        <header className="rounded-3xl bg-white p-6 shadow-soft">
          <h1 className="text-2xl font-bold text-gray-900">我的信念</h1>
          <p className="mt-2 text-gray-600">每条信念都是一个可练习模块，包含理论与具体方法。</p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          {beliefs.map((belief) => (
            <Link
              key={belief.id}
              href={`/modules/beliefs/${belief.id}`}
              className="rounded-2xl bg-white p-5 shadow-soft hover-lift"
            >
              <div className="flex items-center gap-3">
                <span className={`w-9 h-9 rounded-full bg-gradient-to-br ${belief.color} text-white flex items-center justify-center text-sm font-semibold`}>
                  {belief.order}
                </span>
                <p className="font-medium text-gray-800">{belief.newBelief}</p>
              </div>
              <p className="mt-2 text-sm text-gray-500 line-through">{belief.oldBelief}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
