'use client'

import Link from 'next/link'
import { babyRelationshipTemplate, otherTemplates } from '@/data/babyRelationshipTemplate'

const templates = [
  ...otherTemplates.filter((t) => t.id === 'gratitude-journal'),
  ...otherTemplates.filter((t) => t.id === 'love-ability'),
  babyRelationshipTemplate,
  ...otherTemplates.filter((t) => t.id === 'self-attribution'),
  ...otherTemplates.filter((t) => t.id === 'ifs'),
]

export default function TemplateSelectorModulePage() {
  return (
    <main className="min-h-screen gradient-warm px-6 py-8">
      <section className="mx-auto max-w-4xl space-y-4">
        <header className="rounded-3xl bg-white p-6 shadow-soft">
          <h1 className="text-2xl font-bold text-gray-900">选择记录模板</h1>
          <p className="mt-2 text-gray-600">根据你现在的状态，选择一个最贴近的模板开始记录。</p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          {templates.map((template) => (
            <article key={template.id} className="rounded-2xl bg-white p-5 shadow-soft">
              <div className="flex items-center gap-3">
                <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${template.color} flex items-center justify-center text-2xl`}>
                  {template.icon}
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">{template.title}</h2>
                  <p className="text-sm text-gray-500">{template.questionCount} 个问题</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-gray-600">{template.description}</p>
            </article>
          ))}
        </div>

        <Link href="/island" className="inline-flex rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700">
          返回心理安全岛
        </Link>
      </section>
    </main>
  )
}
