'use client'

import Link from 'next/link'

export default function VersionPickerPage() {
  return (
    <main className="min-h-screen gradient-warm px-6 py-10">
      <section className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2 text-center">
          <p className="text-sm font-medium text-rose-500">Nunu Island</p>
          <h1 className="text-3xl font-bold text-gray-900">心理工具双版本入口</h1>
          <p className="text-gray-600">按你的要求，两个版本已拆分为两个独立页面。</p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/island" className="rounded-2xl bg-white p-6 shadow-soft hover-lift">
            <h2 className="text-xl font-semibold text-gray-900">版本 A：心理安全岛</h2>
            <p className="mt-2 text-sm text-gray-600">首页按业务逻辑导流，每个心理工具是独立模块页。</p>
          </Link>

          <Link href="/emotion-space" className="rounded-2xl bg-white p-6 shadow-soft hover-lift">
            <h2 className="text-xl font-semibold text-gray-900">版本 B：情绪记录空间</h2>
            <p className="mt-2 text-sm text-gray-600">以情绪记录空间为总入口，把所有模块集中摆放。</p>
          </Link>
        </div>
      </section>
    </main>
  )
}
