'use client'

import { useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  FileUp,
  Loader2,
  Check,
  X,
  AlertCircle,
  CheckCircle2,
  Square,
  CheckSquare,
} from 'lucide-react'
import { ActivityType, ActivityTypeLabels, MilkSourceLabels } from '@/types/activity'
import { dayjs } from '@/lib/dayjs'
import { AppDrawerMenu } from '@/components/AppDrawerMenu'
import { BackHomeButton } from '@/components/BackHomeButton'
import { withCurrentBabyIdOnApiPath } from '@/lib/baby-scope'

interface ParsedItem {
  type: ActivityType
  startTimeISO: string
  endTimeISO: string | null
  milkAmount: number | null
  milkSource: string | null
  hasPoop: boolean | null
  hasPee: boolean | null
  poopColor: string | null
  peeAmount: string | null
  spitUpType: string | null
  count: number | null
  notes: string | null
  confidence: number
}

interface BatchResult {
  originalText: string
  parsed?: ParsedItem
  error?: string
}

type Step = 'input' | 'review' | 'done'

// 日期时间行的正则：2026/3/27 08:49 或 2026-03-27 08:49
const DATETIME_RE = /^\d{4}[/-]\d{1,2}[/-]\d{1,2}\s+\d{1,2}:\d{2}/

// 标题/头部行（如【宝宝每日数据记录】）
const HEADER_RE = /^[【\[]/

interface BatchEntry {
  text: string
  localTime: string
}

/**
 * 解析粘贴的文本，支持两种格式：
 * 1. 带时间戳的两行格式：时间戳行 + 描述行
 * 2. 纯文本格式：每行一条记录
 */
function parseInputText(raw: string): BatchEntry[] {
  const lines = raw.split('\n').map((l) => l.trim())
  const entries: BatchEntry[] = []
  const now = new Date()
  const fallbackTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`

  let pendingTime: string | null = null

  for (const line of lines) {
    if (!line) continue
    // 跳过标题行
    if (HEADER_RE.test(line)) continue

    if (DATETIME_RE.test(line)) {
      // 这是时间戳行，规范化格式：2026/3/27 08:49 -> 2026-03-27 08:49
      const normalized = line
        .replace(/\//g, '-')
        .replace(/(\d{4})-(\d{1,2})-(\d{1,2})/, (_, y, m, d) =>
          `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`)
      pendingTime = normalized
      continue
    }

    // 这是描述行
    entries.push({
      text: line,
      localTime: pendingTime || fallbackTime,
    })
    pendingTime = null
  }

  return entries
}

function formatParsedSummary(p: ParsedItem): string {
  const parts: string[] = [ActivityTypeLabels[p.type] || p.type]

  const start = dayjs(p.startTimeISO)
  parts.push(start.format('HH:mm'))

  if (p.endTimeISO) {
    const end = dayjs(p.endTimeISO)
    const durationMin = end.diff(start, 'minute')
    if (durationMin > 0) {
      parts.push(`${durationMin}分钟`)
    }
  }

  if (p.milkAmount) {
    const source = p.milkSource ? MilkSourceLabels[p.milkSource as keyof typeof MilkSourceLabels] || '' : ''
    parts.push(`${p.milkAmount}ml${source ? `(${source})` : ''}`)
  }

  if (p.count && (p.type === ActivityType.ROLL_OVER || p.type === ActivityType.PULL_TO_SIT)) {
    parts.push(`${p.count}次`)
  }

  if (p.hasPoop) parts.push('大便')
  if (p.hasPee) parts.push('小便')

  return parts.join(' / ')
}

export default function BatchImportPage() {
  const params = useParams()
  const babyId = params.babyId as string
  const queryClient = useQueryClient()

  const [step, setStep] = useState<Step>('input')
  const [inputText, setInputText] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [results, setResults] = useState<BatchResult[]>([])
  const [checked, setChecked] = useState<boolean[]>([])
  const [submitResult, setSubmitResult] = useState<{ created: number; errors: number } | null>(null)

  const handleParse = useCallback(async () => {
    const entries = parseInputText(inputText)

    if (entries.length === 0) {
      toast.error('请输入至少一条记录')
      return
    }

    setIsParsing(true)
    try {
      const response = await fetch(withCurrentBabyIdOnApiPath('/api/app/batch-parse'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || '解析失败')
        return
      }

      const batchResults: BatchResult[] = data.results
      setResults(batchResults)
      // Default: check all successfully parsed items
      setChecked(batchResults.map((r) => !!r.parsed))
      setStep('review')
    } catch {
      toast.error('网络错误，请重试')
    } finally {
      setIsParsing(false)
    }
  }, [inputText])

  const toggleItem = useCallback((index: number) => {
    setChecked((prev) => {
      const next = [...prev]
      next[index] = !next[index]
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setChecked((prev) => {
      const allChecked = prev.every((c, i) => !results[i]?.parsed || c)
      return prev.map((c, i) => (results[i]?.parsed ? !allChecked : c))
    })
  }, [results])

  const checkedCount = checked.filter((c, i) => c && results[i]?.parsed).length
  const parsedCount = results.filter((r) => r.parsed).length

  const handleSubmit = useCallback(async () => {
    const items = results
      .filter((_, i) => checked[i])
      .filter((r) => r.parsed)
      .map((r) => ({
        type: r.parsed!.type,
        startTime: r.parsed!.startTimeISO,
        endTime: r.parsed!.endTimeISO,
        milkAmount: r.parsed!.milkAmount,
        milkSource: r.parsed!.milkSource,
        hasPoop: r.parsed!.hasPoop,
        hasPee: r.parsed!.hasPee,
        poopColor: r.parsed!.poopColor,
        peeAmount: r.parsed!.peeAmount,
        spitUpType: r.parsed!.spitUpType,
        count: r.parsed!.count,
        notes: r.parsed!.notes,
        originalText: r.originalText,
      }))

    if (items.length === 0) {
      toast.error('请至少选择一条记录')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(withCurrentBabyIdOnApiPath('/api/app/batch-parse'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || '创建失败')
        return
      }

      const createdCount = data.created?.length ?? 0
      const errorCount = data.errors?.length ?? 0
      setSubmitResult({ created: createdCount, errors: errorCount })
      setStep('done')

      queryClient.invalidateQueries({ queryKey: ['get', '/activities'] })
      queryClient.invalidateQueries({ queryKey: ['get', '/activities/latest'] })

      if (createdCount > 0) {
        toast.success(`成功导入 ${createdCount} 条记录`)
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} 条记录创建失败`)
      }
    } catch {
      toast.error('网络错误，请重试')
    } finally {
      setIsSubmitting(false)
    }
  }, [results, checked, queryClient])

  const handleReset = useCallback(() => {
    setStep('input')
    setInputText('')
    setResults([])
    setChecked([])
    setSubmitResult(null)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <BackHomeButton babyId={babyId} />
            <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <FileUp size={20} className="text-violet-500" />
              批量导入
            </h1>
          </div>
          <AppDrawerMenu babyId={babyId} />
        </div>
      </header>

      <main className="px-4 py-4 max-w-lg mx-auto space-y-4">
        {/* Step 1: Input */}
        {step === 'input' && (
          <>
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                直接粘贴聊天记录（带时间戳），或每行写一条记录
              </p>
              <textarea
                data-testid="batch-input-textarea"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`示例（带时间戳）：\n2026/3/27 08:30\n瓶喂母乳80毫升\n2026/3/27 09:00\n宝宝睡觉了\n\n也支持每行一条：\n瓶喂母乳80毫升\n换尿布有大便黄色`}
                rows={12}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 text-base text-gray-800 dark:text-gray-100 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-gray-400">
                  {parseInputText(inputText).length} 条记录
                </span>
                <button
                  data-testid="batch-parse-btn"
                  onClick={handleParse}
                  disabled={isParsing || !inputText.trim()}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white font-medium text-sm shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
                >
                  {isParsing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      解析中...
                    </>
                  ) : (
                    '开始解析'
                  )}
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">支持的格式：</p>
              <div className="space-y-2 text-xs text-gray-400 dark:text-gray-500">
                <div>
                  <p className="text-gray-500 dark:text-gray-400 font-medium mb-0.5">带时间戳（推荐，直接粘贴聊天记录）：</p>
                  <p className="pl-2">2026/3/27 08:30</p>
                  <p className="pl-2">宝宝喝了80毫升奶</p>
                  <p className="pl-2">2026/3/27 09:00</p>
                  <p className="pl-2">宝宝睡觉了</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400 font-medium mb-0.5">纯描述（使用当前时间）：</p>
                  <p className="pl-2">瓶喂母乳80毫升 / 换尿布有大便 / 抬头5分钟</p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Step 2: Review */}
        {step === 'review' && (
          <>
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  解析结果 ({parsedCount}/{results.length} 条成功)
                </p>
                <button
                  data-testid="batch-toggle-all"
                  onClick={toggleAll}
                  className="text-xs text-violet-600 dark:text-violet-400 font-medium"
                >
                  {checkedCount === parsedCount ? '取消全选' : '全选'}
                </button>
              </div>

              <div className="space-y-2">
                {results.map((item, index) => (
                  <div
                    key={index}
                    data-testid={`batch-result-item-${index}`}
                    className={`rounded-xl border p-3 transition-colors ${
                      item.error
                        ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
                        : checked[index]
                          ? 'border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20'
                          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      {item.parsed ? (
                        <button
                          data-testid={`batch-check-${index}`}
                          onClick={() => toggleItem(index)}
                          className="mt-0.5 flex-shrink-0 text-violet-600 dark:text-violet-400"
                        >
                          {checked[index] ? (
                            <CheckSquare size={20} />
                          ) : (
                            <Square size={20} className="text-gray-400" />
                          )}
                        </button>
                      ) : (
                        <div className="mt-0.5 flex-shrink-0">
                          <AlertCircle size={20} className="text-red-500" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        {/* Original text */}
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                          &quot;{item.originalText}&quot;
                        </p>

                        {/* Parsed result */}
                        {item.parsed ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-xs font-medium">
                              {ActivityTypeLabels[item.parsed.type] || item.parsed.type}
                            </span>
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {formatParsedSummary(item.parsed)}
                            </span>
                            {item.parsed.confidence < 0.75 && (
                              <span className="text-xs text-amber-600 dark:text-amber-400">
                                (低置信度)
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-red-600 dark:text-red-400">
                            {item.error}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                data-testid="batch-back-btn"
                onClick={() => setStep('input')}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium"
              >
                返回修改
              </button>
              <button
                data-testid="batch-confirm-btn"
                onClick={handleSubmit}
                disabled={isSubmitting || checkedCount === 0}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    导入中...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    确认导入 ({checkedCount})
                  </>
                )}
              </button>
            </div>
          </>
        )}

        {/* Step 3: Done */}
        {step === 'done' && submitResult && (
          <div data-testid="batch-done-card" className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} className="text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">
                导入完成
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                成功导入 {submitResult.created} 条记录
                {submitResult.errors > 0 && `，${submitResult.errors} 条失败`}
              </p>
            </div>
            <button
              data-testid="batch-reset-btn"
              onClick={handleReset}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm font-medium shadow-md"
            >
              继续导入
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
