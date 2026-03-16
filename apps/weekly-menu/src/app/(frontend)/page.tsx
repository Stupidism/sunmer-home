'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { signOut } from 'next-auth/react'
import { BookOpen, CalendarDays, ChevronLeft, ChevronRight, History } from 'lucide-react'

type RecipeCategory = 'big-meat' | 'small-meat' | 'vegetable'

function toDateKey(date: Date): string {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const CALENDAR_WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日'] as const

function parseDateString(value: string): Date | null {
  const normalized = value.trim().replace(/\./g, '-').replace(/\//g, '-')
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}

function addDays(baseDate: Date, days: number): Date {
  const next = new Date(baseDate)
  next.setDate(next.getDate() + days)
  return next
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function getMonthLabel(date: Date): string {
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
  })
}

function buildCalendarDates(monthDate: Date): Date[] {
  const monthStart = getMonthStart(monthDate)
  const firstWeekday = (monthStart.getDay() + 6) % 7
  const gridStartDate = addDays(monthStart, -firstWeekday)
  return Array.from({ length: 42 }, (_, index) => addDays(gridStartDate, index))
}

function getWeekStartMonday(date: Date): Date {
  const mondayBasedDay = (date.getDay() + 6) % 7
  return addDays(date, -mondayBasedDay)
}

function buildWeekDateKeys(startDate: Date): Set<string> {
  const keys = new Set<string>()
  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    keys.add(toDateKey(addDays(startDate, dayOffset)))
  }
  return keys
}

type WeeklyMenuHistoryItem = {
  menuPeriod?: string
}

export default function HomePage() {
  const router = useRouter()
  const [setupOpen, setSetupOpen] = useState(false)
  const [weekDate, setWeekDate] = useState(() => toDateKey(new Date()))
  const [visibleMonth, setVisibleMonth] = useState(() => getMonthStart(new Date()))
  const [useHistoryReference, setUseHistoryReference] = useState(true)
  const [coveredDateKeys, setCoveredDateKeys] = useState<Set<string>>(() => new Set())
  const [coveredDatesLoading, setCoveredDatesLoading] = useState(false)
  const [coveredDatesError, setCoveredDatesError] = useState('')
  const [uploadName, setUploadName] = useState('')
  const [uploadCategory, setUploadCategory] = useState<RecipeCategory>('vegetable')
  const [uploadDescription, setUploadDescription] = useState('')
  const [uploadingRecipe, setUploadingRecipe] = useState(false)
  const [uploadRecipeMessage, setUploadRecipeMessage] = useState('')

  const selectedDate = parseDateString(weekDate)
  const selectedWeekStartDate = selectedDate ? getWeekStartMonday(selectedDate) : null
  const selectedWeekDateKeys = selectedWeekStartDate
    ? buildWeekDateKeys(selectedWeekStartDate)
    : new Set<string>()
  const overlapDateKeys = new Set(
    [...selectedWeekDateKeys].filter((dateKey) => coveredDateKeys.has(dateKey))
  )
  const hasOverlapInSelectedWeek = overlapDateKeys.size > 0
  const calendarDates = buildCalendarDates(visibleMonth)

  useEffect(() => {
    if (!setupOpen) {
      return
    }

    let active = true

    const loadCoveredDates = async () => {
      setCoveredDatesLoading(true)
      setCoveredDatesError('')

      try {
        const response = await fetch('/api/weekly-menus?limit=200', { method: 'GET' })
        if (!response.ok) {
          const payload = (await response.json()) as { message?: string }
          throw new Error(payload.message || '读取历史菜单失败')
        }

        const payload = (await response.json()) as {
          data?: WeeklyMenuHistoryItem[]
          items?: WeeklyMenuHistoryItem[]
        }
        const coveredKeys = new Set<string>()

        for (const item of payload.data ?? payload.items ?? []) {
          if (!item.menuPeriod) {
            continue
          }

          const startDate = parseDateString(item.menuPeriod)
          if (!startDate) {
            continue
          }

          const weekStartDate = getWeekStartMonday(startDate)
          for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
            coveredKeys.add(toDateKey(addDays(weekStartDate, dayOffset)))
          }
        }

        if (active) {
          setCoveredDateKeys(coveredKeys)
        }
      } catch {
        if (active) {
          setCoveredDateKeys(new Set())
          setCoveredDatesError('暂时无法读取历史菜单，重叠提示已禁用')
        }
      } finally {
        if (active) {
          setCoveredDatesLoading(false)
        }
      }
    }

    void loadCoveredDates()

    return () => {
      active = false
    }
  }, [setupOpen])

  const handleOpenSetup = () => {
    const date = parseDateString(weekDate) ?? new Date()
    setVisibleMonth(getMonthStart(date))
    setSetupOpen(true)
  }

  const handleStartGenerate = () => {
    const params = new URLSearchParams({
      weekDate,
      useHistory: useHistoryReference ? '1' : '0',
    })
    setSetupOpen(false)
    router.push(`/planner?${params.toString()}`)
  }

  const handleMenuDateChange = (value: string) => {
    setWeekDate(value)
    const parsed = parseDateString(value)
    if (parsed) {
      setVisibleMonth(getMonthStart(parsed))
    }
  }

  const handlePickDateFromCalendar = (pickedDate: Date) => {
    setWeekDate(toDateKey(pickedDate))
    setVisibleMonth(getMonthStart(pickedDate))
  }

  const handleShiftMonth = (delta: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))
  }

  const handleSubmitRecipe = async (event: React.FormEvent) => {
    event.preventDefault()
    setUploadRecipeMessage('')

    const name = uploadName.trim()
    const description = uploadDescription.trim()

    if (!name) {
      setUploadRecipeMessage('请填写菜谱名称')
      return
    }

    setUploadingRecipe(true)

    try {
      const response = await fetch('/api/user-recipes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          category: uploadCategory,
          description,
        }),
      })

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string }
        throw new Error(payload.message || '提交失败')
      }

      setUploadName('')
      setUploadDescription('')
      setUploadCategory('vegetable')
      setUploadRecipeMessage('上传成功：你可以立即在菜谱库中自用，等待管理员审核入公共库')
    } catch (submitError) {
      setUploadRecipeMessage(submitError instanceof Error ? submitError.message : '提交失败')
    } finally {
      setUploadingRecipe(false)
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-6">
      <section className="rounded-3xl border border-teal-100 bg-gradient-to-br from-teal-50 via-white to-emerald-50 p-6 shadow-sm">
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: '/login' })}
            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
          >
            退出登录
          </button>
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">菜单制定</h1>
        <p className="mt-2 text-sm text-slate-600">请选择你要进行的操作</p>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={handleOpenSetup}
            className="flex w-full items-center justify-between rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-left transition hover:bg-sky-100"
          >
            <span className="flex items-center gap-3 text-slate-900">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-sky-600 text-white">
                <CalendarDays size={18} />
              </span>
              <span className="text-base font-semibold">生成一周菜单</span>
            </span>
            <span className="text-sm text-slate-500">进入</span>
          </button>

          <Link
            href="/history"
            className="flex w-full items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left transition hover:bg-emerald-100"
          >
            <span className="flex items-center gap-3 text-slate-900">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white">
                <History size={18} />
              </span>
              <span className="text-base font-semibold">查看往期数据</span>
            </span>
            <span className="text-sm text-slate-500">进入</span>
          </Link>

          <Link
            href="/recipes"
            className="flex w-full items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left transition hover:bg-amber-100"
          >
            <span className="flex items-center gap-3 text-slate-900">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-600 text-white">
                <BookOpen size={18} />
              </span>
              <span className="text-base font-semibold">菜谱库</span>
            </span>
            <span className="text-sm text-slate-500">进入</span>
          </Link>

        </div>

        <form onSubmit={handleSubmitRecipe} className="mt-5 rounded-2xl border border-slate-200 bg-white/80 p-4">
          <div className="text-sm font-semibold text-slate-800">上传新菜谱（默认先自用，管理员审核后入公共库）</div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              type="text"
              value={uploadName}
              onChange={(event) => setUploadName(event.target.value)}
              placeholder="菜谱名称"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-teal-600/30 focus:ring"
              required
            />
            <select
              value={uploadCategory}
              onChange={(event) => setUploadCategory(event.target.value as RecipeCategory)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-teal-600/30 focus:ring"
            >
              <option value="big-meat">大荤</option>
              <option value="small-meat">小荤</option>
              <option value="vegetable">素菜</option>
            </select>
          </div>
          <textarea
            value={uploadDescription}
            onChange={(event) => setUploadDescription(event.target.value)}
            placeholder="菜谱说明（可选）"
            rows={2}
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-teal-600/30 focus:ring"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <button
              type="submit"
              disabled={uploadingRecipe}
              className="rounded-full bg-teal-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploadingRecipe ? '提交中...' : '上传菜谱'}
            </button>
            {uploadRecipeMessage ? <p className="text-xs text-slate-600">{uploadRecipeMessage}</p> : null}
          </div>
        </form>
      </section>

      {setupOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900">生成一周菜单设置</h2>
            <p className="mt-1 text-xs text-slate-500">在开始前，请先确认本次生成参数</p>

            <div className="mt-4 space-y-3">
              <label className="block text-sm font-semibold text-slate-700">1. 生成时间（选中周内任意日期）</label>
              <input
                type="date"
                value={weekDate}
                onChange={(event) => handleMenuDateChange(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-teal-600/30 focus:ring"
              />
              <p className="text-[11px] text-slate-500">将按所选日期所在周生成（周一到周日）</p>

              <div className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => handleShiftMonth(-1)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100"
                    aria-label="上个月"
                    title="上个月"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <div className="text-sm font-semibold text-slate-900">{getMonthLabel(visibleMonth)}</div>
                  <button
                    type="button"
                    onClick={() => handleShiftMonth(1)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100"
                    aria-label="下个月"
                    title="下个月"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div className="mt-2 grid grid-cols-7 gap-1">
                  {CALENDAR_WEEK_LABELS.map((weekLabel) => (
                    <div key={weekLabel} className="text-center text-[11px] font-semibold text-slate-400">
                      {weekLabel}
                    </div>
                  ))}
                  {calendarDates.map((dateItem) => {
                    const dateKey = toDateKey(dateItem)
                    const isCurrentMonth = dateItem.getMonth() === visibleMonth.getMonth()
                    const isInSelectedWeek = selectedWeekDateKeys.has(dateKey)
                    const isCovered = coveredDateKeys.has(dateKey)
                    const isOverlap = overlapDateKeys.has(dateKey)
                    const isPickedDate = dateKey === weekDate
                    const dayClassName = [
                      'h-8 rounded-md text-xs font-medium transition',
                      isInSelectedWeek && !isOverlap ? 'bg-sky-100 text-sky-800 ring-1 ring-sky-200' : '',
                      isCovered && !isInSelectedWeek && !isOverlap
                        ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200'
                        : '',
                      isOverlap ? 'bg-rose-100 text-rose-800 ring-1 ring-rose-300' : '',
                      !isInSelectedWeek && !isCovered && !isOverlap
                        ? isCurrentMonth
                          ? 'text-slate-700 hover:bg-slate-100'
                          : 'text-slate-300 hover:bg-slate-50'
                        : '',
                      isPickedDate && !isOverlap ? 'bg-sky-700 text-white ring-0' : '',
                      isPickedDate && isOverlap ? 'bg-rose-600 text-white ring-0' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')

                    return (
                      <button
                        key={dateKey}
                        type="button"
                        onClick={() => handlePickDateFromCalendar(dateItem)}
                        className={dayClassName}
                      >
                        {dateItem.getDate()}
                      </button>
                    )
                  })}
                </div>

                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span>{coveredDatesLoading ? '正在读取历史菜单...' : '蓝色为本次周菜单，红色为重叠报警'}</span>
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-sky-500" />本次
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-rose-500" />重叠
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />已覆盖
                    </span>
                  </span>
                </div>
                {hasOverlapInSelectedWeek ? (
                  <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] text-rose-700">
                    当前选择周与已保存菜单重叠 {overlapDateKeys.size} 天。
                  </div>
                ) : null}
                {coveredDatesError ? <p className="mt-1 text-[11px] text-rose-600">{coveredDatesError}</p> : null}
              </div>

              <label className="mt-2 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <input
                  type="checkbox"
                  checked={useHistoryReference}
                  onChange={(event) => setUseHistoryReference(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-700">2. 参考以往数据</span>
                  <span className="block text-xs text-slate-500">开启后会优先参考上一周已保存菜单，尽量减少重复</span>
                </span>
              </label>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSetupOpen(false)}
                className="rounded-full bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-300"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleStartGenerate}
                className="rounded-full bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
              >
                开始生成
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
