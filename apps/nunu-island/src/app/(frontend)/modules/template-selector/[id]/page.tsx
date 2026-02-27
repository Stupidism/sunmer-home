'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { gratitudeTemplate } from '@/data/gratitudeTemplate'
import { loveAbilityTemplate } from '@/data/loveAbilityTemplate'
import { babyRelationshipTemplate } from '@/data/babyRelationshipTemplate'
import { selfAttributionTemplate } from '@/data/selfAttributionTemplate'
import { ifsTemplate } from '@/data/ifsTemplate'
import { fetchTemplates } from '@/lib/content/fetch'
import type { Answer, Question, Template } from '@/types'

const fullTemplates: Record<string, Template> = {
  'gratitude-journal': gratitudeTemplate,
  'love-ability': loveAbilityTemplate,
  'baby-relationship': babyRelationshipTemplate,
  'self-attribution': selfAttributionTemplate,
  ifs: ifsTemplate,
}

function flattenQuestions(template: Template): Question[] {
  if (Array.isArray(template.layers) && template.layers.length > 0) {
    return template.layers.flatMap((layer) => layer.questions)
  }

  if (Array.isArray(template.questions)) {
    return template.questions
  }

  return []
}

function isAnswered(question: Question, value: string | string[] | number | undefined): boolean {
  if (value === undefined || value === null) return false

  if (question.type === 'multiple') {
    return Array.isArray(value) && value.length > 0
  }

  if (question.type === 'slider') {
    return typeof value === 'number'
  }

  if (question.type === 'text' || question.type === 'textarea') {
    return typeof value === 'string' && value.trim().length > 0
  }

  return typeof value === 'string' && value.length > 0
}

export default function TemplateQuestionnairePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()

  const [templates, setTemplates] = useState<Template[]>(Object.values(fullTemplates))
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string | string[] | number>>({})
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    let active = true

    const load = async () => {
      const fromApi = await fetchTemplates()
      const merged = fromApi.map((template) => {
        const full = fullTemplates[template.id]
        return full ? { ...template, layers: full.layers, questions: full.questions } : template
      })

      if (active) {
        setTemplates(merged)
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [])

  const template = useMemo(() => {
    const found = templates.find((item) => item.id === params.id)
    return found || fullTemplates[params.id]
  }, [templates, params.id])

  const questions = useMemo(() => (template ? flattenQuestions(template) : []), [template])
  const currentQuestion = questions[questionIndex]
  const progress = questions.length > 0 ? Math.round(((questionIndex + 1) / questions.length) * 100) : 0

  if (!template) {
    return (
      <main className="min-h-screen gradient-warm px-6 py-8">
        <section className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-soft">
          <h1 className="text-xl font-bold text-gray-900">模板不存在</h1>
          <p className="mt-2 text-sm text-gray-600">你访问的模板还没有配置完整。</p>
          <Link href="/modules/template-selector" className="mt-4 inline-flex rounded-xl bg-gray-900 px-3 py-2 text-sm text-white">
            返回模板列表
          </Link>
        </section>
      </main>
    )
  }

  if (questions.length === 0) {
    return (
      <main className="min-h-screen gradient-warm px-6 py-8">
        <section className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-soft">
          <h1 className="text-xl font-bold text-gray-900">模板问题暂未配置</h1>
          <p className="mt-2 text-sm text-gray-600">`{template.title}` 现在只有简介，暂时没有逐题内容。</p>
          <Link href="/modules/template-selector" className="mt-4 inline-flex rounded-xl bg-gray-900 px-3 py-2 text-sm text-white">
            返回模板列表
          </Link>
        </section>
      </main>
    )
  }

  const value = answers[currentQuestion.id]

  const updateAnswer = (next: string | string[] | number) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: next }))
  }

  const goNext = () => {
    if (questionIndex < questions.length - 1) {
      setQuestionIndex((prev) => prev + 1)
      return
    }

    const record: { id: string; templateId: string; templateTitle: string; answers: Answer[]; createdAt: string } = {
      id: crypto.randomUUID(),
      templateId: template.id,
      templateTitle: template.title,
      answers: questions
        .filter((q) => answers[q.id] !== undefined)
        .map((q) => ({ questionId: q.id, value: answers[q.id] as string | string[] | number })),
      createdAt: new Date().toISOString(),
    }

    const existingRaw = localStorage.getItem('template-records')
    const existing = existingRaw ? (JSON.parse(existingRaw) as typeof record[]) : []
    localStorage.setItem('template-records', JSON.stringify([record, ...existing]))
    setSubmitted(true)
  }

  const goPrev = () => {
    if (questionIndex > 0) setQuestionIndex((prev) => prev - 1)
  }

  return (
    <main className="min-h-screen gradient-warm px-6 py-8">
      <section className="mx-auto max-w-3xl space-y-4">
        <header className="rounded-2xl bg-white p-6 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-bold text-gray-900">{template.title}</h1>
            <span className="text-sm text-gray-500">
              {questionIndex + 1} / {questions.length}
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-600">{template.description}</p>
          <div className="mt-4 h-2 rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-gray-900 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </header>

        {!submitted ? (
          <article className="rounded-2xl bg-white p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-gray-900">{currentQuestion.text}</h2>
            {currentQuestion.subtitle ? <p className="mt-2 text-sm text-gray-500">{currentQuestion.subtitle}</p> : null}

            <div className="mt-4">
              {(currentQuestion.type === 'text' || currentQuestion.type === 'textarea') && (
                <textarea
                  value={typeof value === 'string' ? value : ''}
                  onChange={(event) => updateAnswer(event.target.value)}
                  rows={currentQuestion.type === 'textarea' ? 6 : 3}
                  className="w-full rounded-xl border border-gray-200 p-3 text-sm outline-none focus:border-gray-400"
                  placeholder={currentQuestion.placeholder || '请输入'}
                />
              )}

              {currentQuestion.type === 'single' && currentQuestion.options ? (
                <div className="grid gap-2">
                  {currentQuestion.options.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => updateAnswer(option.id)}
                      className={`rounded-xl border px-3 py-2 text-left text-sm ${
                        value === option.id ? 'border-gray-900 bg-gray-50' : 'border-gray-200'
                      }`}
                    >
                      <span className="mr-2">{option.emoji || '•'}</span>
                      {option.text}
                    </button>
                  ))}
                </div>
              ) : null}

              {currentQuestion.type === 'multiple' && currentQuestion.options ? (
                <div className="grid gap-2">
                  {currentQuestion.options.map((option) => {
                    const selected = Array.isArray(value) ? value.includes(option.id) : false
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          const current = Array.isArray(value) ? value : []
                          const next = selected
                            ? current.filter((item) => item !== option.id)
                            : [...current, option.id]
                          updateAnswer(next)
                        }}
                        className={`rounded-xl border px-3 py-2 text-left text-sm ${
                          selected ? 'border-gray-900 bg-gray-50' : 'border-gray-200'
                        }`}
                      >
                        <span className="mr-2">{option.emoji || '•'}</span>
                        {option.text}
                      </button>
                    )
                  })}
                </div>
              ) : null}

              {currentQuestion.type === 'slider' && (
                <div className="space-y-2">
                  <input
                    type="range"
                    min={currentQuestion.min ?? 1}
                    max={currentQuestion.max ?? 10}
                    step={currentQuestion.step ?? 1}
                    value={typeof value === 'number' ? value : currentQuestion.min ?? 1}
                    onChange={(event) => updateAnswer(Number(event.target.value))}
                    className="w-full"
                  />
                  <p className="text-sm text-gray-600">当前分值：{typeof value === 'number' ? value : currentQuestion.min ?? 1}</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={goPrev}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-700 disabled:opacity-40"
                disabled={questionIndex === 0}
              >
                上一题
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={!isAnswered(currentQuestion, value)}
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-40"
              >
                {questionIndex === questions.length - 1 ? '提交' : '下一题'}
              </button>
            </div>
          </article>
        ) : (
          <article className="rounded-2xl bg-white p-6 text-center shadow-soft">
            <h2 className="text-lg font-semibold text-gray-900">已完成记录</h2>
            <p className="mt-2 text-sm text-gray-600">你的回答已保存到本地记录。</p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-700"
                onClick={() => router.push('/modules/template-selector')}
              >
                返回模板列表
              </button>
              <button
                type="button"
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm text-white"
                onClick={() => {
                  setSubmitted(false)
                  setQuestionIndex(0)
                  setAnswers({})
                }}
              >
                重新作答
              </button>
            </div>
          </article>
        )}

        <Link href="/modules/template-selector" className="inline-flex rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700">
          返回模板列表
        </Link>
      </section>
    </main>
  )
}
