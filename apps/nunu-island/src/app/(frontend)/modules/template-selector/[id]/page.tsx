'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { gratitudeTemplate } from '@/data/gratitudeTemplate'
import { loveAbilityTemplate } from '@/data/loveAbilityTemplate'
import { babyRelationshipTemplate } from '@/data/babyRelationshipTemplate'
import { selfAttributionTemplate } from '@/data/selfAttributionTemplate'
import { ifsTemplate } from '@/data/ifsTemplate'
import { fetchTemplates } from '@/lib/content/fetch'
import type { Answer, Option, Question, Template } from '@/types'

const fullTemplates: Record<string, Template> = {
  'gratitude-journal': gratitudeTemplate,
  'love-ability': loveAbilityTemplate,
  'baby-relationship': babyRelationshipTemplate,
  'self-attribution': selfAttributionTemplate,
  ifs: ifsTemplate,
}

function mergeFullTemplate(template: Template): Template {
  const full = fullTemplates[template.id]
  if (!full) return template

  return {
    ...template,
    layers: full.layers,
    questions: full.questions,
  }
}

function isAnswered(question: Question, value: string | string[] | number | undefined): boolean {
  if (value === undefined || value === null) return false

  if (question.type === 'multiple') return Array.isArray(value) && value.length > 0
  if (question.type === 'slider') return typeof value === 'number'
  if (question.type === 'text' || question.type === 'textarea') {
    return typeof value === 'string' && value.trim().length > 0
  }

  return typeof value === 'string' && value.length > 0
}

export default function TemplateQuestionnairePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [template, setTemplate] = useState<Template | null>(fullTemplates[params.id] || null)
  const [answers, setAnswers] = useState<Record<string, string | string[] | number>>({})
  const [currentLayerIndex, setCurrentLayerIndex] = useState(0)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [showLayerIntro, setShowLayerIntro] = useState(true)
  const [direction, setDirection] = useState(1)
  const [submitted, setSubmitted] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      const fromApi = await fetchTemplates()
      const selected = fromApi.find((item) => item.id === params.id)
      const merged = selected ? mergeFullTemplate(selected) : fullTemplates[params.id] || null
      if (active) setTemplate(merged)
    }

    void load()
    return () => {
      active = false
    }
  }, [params.id])

  const layers = useMemo(() => template?.layers || [], [template])
  const currentLayer = layers[currentLayerIndex]
  const currentQuestion = currentLayer?.questions[currentQuestionIndex]

  const totalQuestions = useMemo(
    () => layers.reduce((sum, layer) => sum + layer.questions.length, 0),
    [layers]
  )

  const answeredQuestions = useMemo(() => {
    let count = 0
    for (let i = 0; i < currentLayerIndex; i += 1) {
      count += layers[i].questions.length
    }
    count += currentQuestionIndex
    if (!showLayerIntro) count += 1
    return count
  }, [currentLayerIndex, currentQuestionIndex, layers, showLayerIntro])

  const progress = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0
  const isLastLayer = currentLayerIndex === layers.length - 1
  const isLastQuestion = currentQuestion ? currentQuestionIndex === currentLayer.questions.length - 1 : false

  const handleSelectOption = useCallback(
    (value: string | string[] | number) => {
      if (!currentQuestion) return
      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }))
    },
    [currentQuestion]
  )

  const saveRecord = useCallback(async () => {
    if (!template) return

    setIsSaving(true)
    setSaveError(null)

    const finalAnswers: Answer[] = Object.entries(answers).map(([questionId, value]) => ({
      questionId,
      value,
    }))

    try {
      const response = await fetch('/api/content/template-records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateId: template.id,
          templateTitle: template.title,
          answers: finalAnswers,
        }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error || '保存失败，请稍后重试')
      }

      setSubmitted(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存失败，请稍后重试'
      setSaveError(message)
    } finally {
      setIsSaving(false)
    }
  }, [answers, template])

  const handleNext = useCallback(() => {
    if (showLayerIntro) {
      setShowLayerIntro(false)
      return
    }

    if (isLastQuestion && isLastLayer) {
      void saveRecord()
      return
    }

    if (isLastQuestion) {
      setDirection(1)
      setCurrentLayerIndex((prev) => prev + 1)
      setCurrentQuestionIndex(0)
      setShowLayerIntro(true)
      return
    }

    setDirection(1)
    setCurrentQuestionIndex((prev) => prev + 1)
  }, [isLastLayer, isLastQuestion, saveRecord, showLayerIntro])

  const handlePrevious = useCallback(() => {
    if (showLayerIntro && currentLayerIndex > 0) {
      setDirection(-1)
      const prevLayer = layers[currentLayerIndex - 1]
      setCurrentLayerIndex((prev) => prev - 1)
      setCurrentQuestionIndex(prevLayer.questions.length - 1)
      setShowLayerIntro(false)
      return
    }

    if (!showLayerIntro && currentQuestionIndex === 0) {
      setShowLayerIntro(true)
      return
    }

    if (!showLayerIntro && currentQuestionIndex > 0) {
      setDirection(-1)
      setCurrentQuestionIndex((prev) => prev - 1)
    }
  }, [currentLayerIndex, currentQuestionIndex, layers, showLayerIntro])

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

  if (layers.length === 0 || !currentLayer || !currentQuestion) {
    return (
      <main className="min-h-screen gradient-warm px-6 py-8">
        <section className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-soft">
          <h1 className="text-xl font-bold text-gray-900">模板问题暂未配置</h1>
          <p className="mt-2 text-sm text-gray-600">`{template.title}` 当前没有可用题目。</p>
          <Link href="/modules/template-selector" className="mt-4 inline-flex rounded-xl bg-gray-900 px-3 py-2 text-sm text-white">
            返回模板列表
          </Link>
        </section>
      </main>
    )
  }

  const canProceed = (showLayerIntro || isAnswered(currentQuestion, answers[currentQuestion.id])) && !isSaving

  return (
    <main className="min-h-screen gradient-warm">
      <header className="sticky top-0 z-50 border-b border-rose-100/50 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <button onClick={() => router.push('/modules/template-selector')} className="flex items-center gap-2 text-sm text-gray-600">
            <ArrowLeft className="h-4 w-4" />
            返回
          </button>
          <span className="text-sm text-gray-500">第 {currentLayerIndex + 1} / {layers.length} 层</span>
        </div>
        <div className="h-1 bg-rose-100">
          <motion.div className="h-full bg-gray-900" initial={{ width: 0 }} animate={{ width: `${progress}%` }} />
        </div>
      </header>

      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        {!submitted ? (
          <AnimatePresence mode="wait" custom={direction}>
            {showLayerIntro ? (
              <motion.article
                key={`layer-${currentLayer.id}`}
                custom={direction}
                initial={{ x: direction > 0 ? 40 : -40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: direction > 0 ? -40 : 40, opacity: 0 }}
                className="flex flex-1 flex-col items-center justify-center rounded-2xl bg-white p-8 text-center shadow-soft"
              >
                <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${currentLayer.color}`}>
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">{currentLayer.title}</h1>
                <p className="mt-2 text-gray-600">{currentLayer.subtitle}</p>
                <p className="mt-4 text-sm text-gray-500">共 {currentLayer.questions.length} 个问题</p>
              </motion.article>
            ) : (
              <motion.article
                key={currentQuestion.id}
                custom={direction}
                initial={{ x: direction > 0 ? 40 : -40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: direction > 0 ? -40 : 40, opacity: 0 }}
                className="flex flex-1 flex-col rounded-2xl bg-white p-6 shadow-soft"
              >
                <span className={`inline-flex w-fit items-center rounded-full bg-gradient-to-r px-3 py-1 text-xs text-white ${currentLayer.color}`}>
                  {currentLayer.title}
                </span>
                <h2 className="mt-4 text-xl font-semibold text-gray-900">{currentQuestion.text}</h2>
                {currentQuestion.subtitle ? <p className="mt-2 text-sm text-gray-500">{currentQuestion.subtitle}</p> : null}

                <div className="mt-6 flex-1">
                  <QuestionInput
                    question={currentQuestion}
                    value={answers[currentQuestion.id]}
                    onChange={handleSelectOption}
                  />
                </div>
              </motion.article>
            )}
          </AnimatePresence>
        ) : (
          <article className="flex flex-1 flex-col items-center justify-center rounded-2xl bg-white p-8 text-center shadow-soft">
            <h2 className="text-2xl font-bold text-gray-900">记录完成</h2>
            <p className="mt-2 text-gray-600">你的回答已保存到数据库记录。</p>
            <div className="mt-6 flex items-center gap-3">
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
                  setSaveError(null)
                  setAnswers({})
                  setCurrentLayerIndex(0)
                  setCurrentQuestionIndex(0)
                  setShowLayerIntro(true)
                }}
              >
                再写一次
              </button>
            </div>
          </article>
        )}

        {!submitted ? (
          <div className="mt-6 flex items-center justify-between border-t border-rose-100 pt-4">
            <button
              type="button"
              onClick={handlePrevious}
              disabled={currentLayerIndex === 0 && currentQuestionIndex === 0 && showLayerIntro}
              className="rounded-xl px-4 py-2 text-sm text-gray-600 disabled:opacity-40"
            >
              {showLayerIntro ? '上一层' : '上一题'}
            </button>
            {saveError ? <p className="text-sm text-rose-600">{saveError}</p> : null}
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed}
              className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2 text-sm text-white disabled:opacity-40"
            >
              <span>
                {showLayerIntro
                  ? '开始'
                  : isSaving
                    ? '保存中...'
                  : isLastQuestion && isLastLayer
                    ? '完成'
                    : isLastQuestion
                      ? '下一层'
                      : '下一题'}
              </span>
              {isLastQuestion && isLastLayer && !showLayerIntro ? <Check className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        ) : null}
      </section>
    </main>
  )
}

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: Question
  value: string | string[] | number | undefined
  onChange: (value: string | string[] | number) => void
}) {
  if (question.type === 'single' && question.options) {
    return <ChoiceInput options={question.options} value={typeof value === 'string' ? value : ''} onChange={onChange} multiple={false} />
  }

  if (question.type === 'multiple' && question.options) {
    return <ChoiceInput options={question.options} value={Array.isArray(value) ? value : []} onChange={onChange} multiple />
  }

  if (question.type === 'slider') {
    const sliderValue = typeof value === 'number' ? value : question.min || 1
    return (
      <div className="space-y-3">
        <Slider
          value={[sliderValue]}
          onValueChange={(vals) => onChange(vals[0])}
          min={question.min || 1}
          max={question.max || 10}
          step={question.step || 1}
        />
        <p className="text-sm text-gray-600">当前分值：{sliderValue}</p>
      </div>
    )
  }

  if (question.type === 'textarea') {
    return (
      <Textarea
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={question.placeholder || '请输入'}
        className="min-h-[180px]"
      />
    )
  }

  return (
    <Input
      value={typeof value === 'string' ? value : ''}
      onChange={(event) => onChange(event.target.value)}
      placeholder={question.placeholder || '请输入'}
    />
  )
}

function ChoiceInput({
  options,
  value,
  onChange,
  multiple,
}: {
  options: Option[]
  value: string | string[]
  onChange: (value: string | string[]) => void
  multiple: boolean
}) {
  return (
    <div className="space-y-2">
      {options.map((option) => {
        const selected = multiple ? Array.isArray(value) && value.includes(option.id) : value === option.id

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              if (!multiple) {
                onChange(option.id)
                return
              }

              const current = Array.isArray(value) ? value : []
              onChange(selected ? current.filter((id) => id !== option.id) : [...current, option.id])
            }}
            className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${selected ? 'border-gray-900 bg-gray-50' : 'border-gray-200'}`}
          >
            <span className="mr-2">{option.emoji || '•'}</span>
            {option.text}
          </button>
        )
      })}
    </div>
  )
}
