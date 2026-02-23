'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Lightbulb } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { babyRelationshipTemplate, otherTemplates } from '@/data/babyRelationshipTemplate'

const scenarioGuides = [
  {
    id: 'scenario-1',
    title: '和宝宝之间发生了让你困惑的事',
    templates: ['baby-relationship', 'ifs'],
  },
  {
    id: 'scenario-2',
    title: '心里涌起一股暖意，哪怕很小',
    templates: ['gratitude-journal'],
  },
  {
    id: 'scenario-3',
    title: '你主动付出了爱，或者创造了美',
    templates: ['love-ability'],
  },
  {
    id: 'scenario-4',
    title: '你又在怪自己，觉得"都是我的错"',
    templates: ['self-attribution', 'ifs'],
  },
  {
    id: 'scenario-5',
    title: '关系冲突时，对某人强烈反感',
    templates: ['ifs'],
  },
]

const orderedTemplates = [
  ...otherTemplates.filter((t) => t.id === 'gratitude-journal'),
  ...otherTemplates.filter((t) => t.id === 'love-ability'),
  babyRelationshipTemplate,
  ...otherTemplates.filter((t) => t.id === 'self-attribution'),
  ...otherTemplates.filter((t) => t.id === 'ifs'),
]

const getTemplateById = (id: string) => orderedTemplates.find((item) => item.id === id)

export default function ScenarioGuideModulePage() {
  const [expandedScenario, setExpandedScenario] = useState<string | null>(null)

  return (
    <main className="min-h-screen gradient-warm px-6 py-8">
      <section className="mx-auto max-w-4xl space-y-4">
        <header className="rounded-3xl bg-white p-6 shadow-soft">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            不知道选哪个？看看场景指引
          </h1>
          <p className="mt-2 text-gray-600">按你当前的处境，直接找到建议的记录模板。</p>
        </header>

        <div className="space-y-3">
          {scenarioGuides.map((scenario) => (
            <div key={scenario.id} className="bg-white rounded-2xl shadow-soft overflow-hidden">
              <button
                onClick={() => setExpandedScenario(expandedScenario === scenario.id ? null : scenario.id)}
                className="w-full p-4 flex items-center justify-between text-left"
              >
                <span className="text-gray-700 font-medium">{scenario.title}</span>
                <ChevronDown
                  className={`w-5 h-5 text-gray-400 transition-transform ${expandedScenario === scenario.id ? 'rotate-180' : ''}`}
                />
              </button>

              <AnimatePresence>
                {expandedScenario === scenario.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-gray-100"
                  >
                    <div className="p-4 space-y-2">
                      <p className="text-sm text-gray-400 mb-2">推荐模板：</p>
                      <div className="flex flex-wrap gap-2">
                        {scenario.templates.map((templateId) => {
                          const template = getTemplateById(templateId)
                          if (!template) return null

                          return (
                            <Link
                              key={templateId}
                              href={`/modules/template-selector#${templateId}`}
                              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-50 hover:bg-rose-50 transition-colors"
                            >
                              <span className="text-lg">{template.icon}</span>
                              <span className="text-sm text-gray-700">{template.title}</span>
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        <Link href="/island" className="inline-flex rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700">
          返回心理安全岛
        </Link>
      </section>
    </main>
  )
}
