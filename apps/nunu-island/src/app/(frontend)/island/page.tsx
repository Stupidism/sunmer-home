'use client'

import Link from 'next/link'
import { ModuleCards } from '@/components/modules/ModuleCards'
import { moduleCatalog } from '@/lib/modules/catalog'

const logicBlocks = [
  {
    key: 'morning',
    title: '早晨：稳定和启动',
    desc: '先看温暖文章，再用场景指引进入当天节奏。',
  },
  {
    key: 'daytime',
    title: '白天：觉察和调节',
    desc: '先识别情绪，再选择对应调节工具。',
  },
  {
    key: 'evening',
    title: '晚上：复盘和记录',
    desc: '从模板进入深度记录，并回看关系与成长轨迹。',
  },
  {
    key: 'anytime',
    title: '随时：快速稳定',
    desc: '当下情绪波动时，先回到身体和当下。',
  },
] as const

export default function IslandVersionPage() {
  return (
    <main className="min-h-screen gradient-warm px-6 py-8">
      <section className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-3xl bg-white p-6 shadow-soft">
          <p className="text-sm font-medium text-rose-500">版本 A</p>
          <h1 className="text-3xl font-bold text-gray-900">心理安全岛（模块化导航）</h1>
          <p className="mt-2 text-gray-600">每个工具都是独立页面，入口按业务逻辑导向正确模块。</p>
        </header>

        {logicBlocks.map((block) => (
          <article key={block.title} className="rounded-3xl bg-white p-6 shadow-soft space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{block.title}</h2>
              <p className="text-gray-600">{block.desc}</p>
            </div>
            <ModuleCards items={moduleCatalog.filter((item) => item.bucket === block.key)} />
          </article>
        ))}

        <Link href="/emotion-space" className="inline-flex rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700">
          查看版本 B（情绪记录空间）
        </Link>
      </section>
    </main>
  )
}
