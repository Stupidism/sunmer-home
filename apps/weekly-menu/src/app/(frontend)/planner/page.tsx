'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Menu, Printer, RefreshCw, Save } from 'lucide-react'
import {
  generateWeeklyMenu,
  replaceDishInPlan,
  type CustomDishPools,
  type DishSlot,
  type WeeklyPlan,
} from '@/lib/weekly-menu/generator'

type WeeklyMenuHistoryItem = {
  menuPeriod?: string
  weeklyPlan?: WeeklyPlan
}

type UserRecipeItem = {
  name?: string
  category?: 'big-meat' | 'small-meat' | 'vegetable'
}

type DishCardProps = {
  slot: DishSlot
  label: string
  value: string
  toneClassName: string
  dayIndex: number
  mealIndex: number
  onReplace: (dayIndex: number, mealIndex: number, slot: DishSlot) => void
}

function DishCard({ slot, label, value, toneClassName, dayIndex, mealIndex, onReplace }: DishCardProps) {
  return (
    <div className={`rounded-lg px-2 py-1.5 ${toneClassName}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="font-medium">{value}</span>
        </div>
        <button
          type="button"
          onClick={() => onReplace(dayIndex, mealIndex, slot)}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/70 transition hover:bg-white"
          aria-label={`切换${label}`}
          title={`切换${label}`}
        >
          <RefreshCw size={13} />
        </button>
      </div>
    </div>
  )
}

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

function toDateKey(date: Date): string {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(baseDate: Date, days: number): Date {
  const next = new Date(baseDate)
  next.setDate(next.getDate() + days)
  return next
}

function buildWeekDateKeys(startDate: Date): Set<string> {
  const keys = new Set<string>()
  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    keys.add(toDateKey(addDays(startDate, dayOffset)))
  }
  return keys
}

function getWeekStartMonday(date: Date): Date {
  const mondayBasedDay = (date.getDay() + 6) % 7
  return addDays(date, -mondayBasedDay)
}

function formatDateKeyForDisplay(dateKey: string): string {
  const parsed = parseDateString(dateKey)
  if (!parsed) {
    return dateKey
  }

  return parsed.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  })
}

function normalizeClientErrorMessage(message: string, fallback: string): string {
  const lower = message.toLowerCase()
  const looksLikeConnectionIssue =
    lower.includes('tls') ||
    lower.includes('socket') ||
    lower.includes('econn') ||
    lower.includes('network') ||
    lower.includes('database') ||
    lower.includes('postgres')

  if (looksLikeConnectionIssue) {
    return '数据库连接异常，请检查本地数据库配置'
  }

  return fallback
}

export default function MealPlannerPage() {
  const router = useRouter()
  const [weeklyPlan, setWeeklyPlan] = useState(() => generateWeeklyMenu())
  const [previousWeekPlan, setPreviousWeekPlan] = useState<WeeklyPlan | undefined>(undefined)
  const [useHistoryReference, setUseHistoryReference] = useState(false)
  const [referenceStatus, setReferenceStatus] = useState('')
  const [isReferencePreparing, setIsReferencePreparing] = useState(false)
  const [isReferenceReady, setIsReferenceReady] = useState(false)
  const [customDishPools, setCustomDishPools] = useState<CustomDishPools>({})
  const [hasGeneratedMenu, setHasGeneratedMenu] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [menuDate, setMenuDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [coveredDateKeys, setCoveredDateKeys] = useState<Set<string>>(() => new Set())
  const [overlapConfirmOpen, setOverlapConfirmOpen] = useState(false)

  const selectedStartDate = parseDateString(menuDate)
  const selectedWeekStartDate = selectedStartDate ? getWeekStartMonday(selectedStartDate) : null
  const selectedWeekDateKeys = selectedWeekStartDate
    ? buildWeekDateKeys(selectedWeekStartDate)
    : new Set<string>()
  const overlapDateKeys = new Set(
    [...selectedWeekDateKeys].filter((dateKey) => coveredDateKeys.has(dateKey))
  )
  const hasOverlapInSelectedWeek = overlapDateKeys.size > 0
  const overlapDateList = [...overlapDateKeys].sort((left, right) => left.localeCompare(right))
  const selectedWeekLabel = selectedWeekStartDate
    ? `${formatDateKeyForDisplay(toDateKey(selectedWeekStartDate))} - ${formatDateKeyForDisplay(toDateKey(addDays(selectedWeekStartDate, 6)))}`
    : '--'

  useEffect(() => {
    let active = true

    const initializePlanner = async () => {
      if (active) {
        setWeeklyPlan([])
        setHasGeneratedMenu(false)
        setIsReferenceReady(false)
      }

      try {
        const userRecipeResponse = await fetch('/api/user-recipes?usable=1', { method: 'GET' })
        if (userRecipeResponse.ok) {
          const payload = (await userRecipeResponse.json()) as {
            data?: UserRecipeItem[]
            items?: UserRecipeItem[]
          }
          const recipes = payload.data ?? payload.items ?? []

          const pools: CustomDishPools = {
            bigMeat: [],
            smallMeat: [],
            vegetable: [],
          }

          for (const recipe of recipes) {
            const name = typeof recipe.name === 'string' ? recipe.name.trim() : ''
            if (!name || !recipe.category) {
              continue
            }

            if (recipe.category === 'big-meat') {
              pools.bigMeat?.push(name)
            } else if (recipe.category === 'small-meat') {
              pools.smallMeat?.push(name)
            } else if (recipe.category === 'vegetable') {
              pools.vegetable?.push(name)
            }
          }

          if (active) {
            setCustomDishPools(pools)
          }
        }
      } catch {
        if (active) {
          setCustomDishPools({})
        }
      }

      const params = new URLSearchParams(window.location.search)
      const weekDateFromQuery = params.get('weekDate')
      const queryDate = weekDateFromQuery ? parseDateString(weekDateFromQuery) : null
      const baseDate = queryDate ?? new Date()
      const baseDateKey = toDateKey(baseDate)

      if (active) {
        setMenuDate(baseDateKey)
      }

      const useHistory = params.get('useHistory') === '1'
      if (!useHistory) {
        if (active) {
          setUseHistoryReference(false)
          setPreviousWeekPlan(undefined)
          setReferenceStatus('未开启参考以往数据')
          setIsReferencePreparing(false)
          setIsReferenceReady(true)
        }
        return
      }

      const weekStart = getWeekStartMonday(baseDate)
      const previousWeekStart = addDays(weekStart, -7)
      const previousWeekStartKey = toDateKey(previousWeekStart)

      if (active) {
        setUseHistoryReference(true)
        setReferenceStatus('正在读取上一周历史数据...')
        setIsReferencePreparing(true)
      }

      try {
        const response = await fetch('/api/weekly-menus?limit=300', { method: 'GET' })
        if (!response.ok) {
          const payload = (await response.json()) as { message?: string }
          throw new Error(payload.message || '读取历史数据失败')
        }

        const payload = (await response.json()) as {
          data?: WeeklyMenuHistoryItem[]
          items?: WeeklyMenuHistoryItem[]
        }
        const matched = (payload.data ?? payload.items ?? []).find((item) => {
          if (!item.menuPeriod) {
            return false
          }
          const savedDate = parseDateString(item.menuPeriod)
          if (!savedDate) {
            return false
          }
          const savedWeekStart = toDateKey(getWeekStartMonday(savedDate))
          return savedWeekStart === previousWeekStartKey
        })

        const referencePlan = matched?.weeklyPlan
        if (active) {
          setPreviousWeekPlan(referencePlan)
          if (referencePlan) {
            setReferenceStatus(`已参考上一周（${formatDateKeyForDisplay(previousWeekStartKey)} 开始）数据`)
          } else {
            setReferenceStatus('未找到上一周历史数据，已使用默认生成策略')
          }
          setIsReferencePreparing(false)
          setIsReferenceReady(true)
        }
      } catch (error) {
        if (active) {
          const message = error instanceof Error ? error.message : ''
          setPreviousWeekPlan(undefined)
          setReferenceStatus(normalizeClientErrorMessage(message, '历史数据读取失败，已使用默认生成策略'))
          setIsReferencePreparing(false)
          setIsReferenceReady(true)
        }
      }
    }

    void initializePlanner()

    return () => {
      active = false
    }
  }, [])

  const handleGenerateCurrentWeek = () => {
    setWeeklyPlan(generateWeeklyMenu(previousWeekPlan, customDishPools))
    setHasGeneratedMenu(true)
  }

  useEffect(() => {
    if (!saveDialogOpen) {
      return
    }

    let active = true

    const loadCoveredDates = async () => {
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

          for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
            coveredKeys.add(toDateKey(addDays(startDate, dayOffset)))
          }
        }

        if (active) {
          setCoveredDateKeys(coveredKeys)
        }
      } catch (error) {
        if (active) {
          const message = error instanceof Error ? error.message : ''
          setCoveredDateKeys(new Set())
          setSaveStatus(normalizeClientErrorMessage(message, '暂时无法读取历史菜单，重叠提示已禁用'))
        }
      }
    }

    void loadCoveredDates()

    return () => {
      active = false
    }
  }, [saveDialogOpen])

  const handleReplaceDish = (dayIndex: number, mealIndex: number, slot: DishSlot) => {
    setWeeklyPlan((current) =>
      replaceDishInPlan(current, dayIndex, mealIndex, slot, previousWeekPlan, customDishPools)
    )
  }

  const handleRegenerate = () => {
    handleGenerateCurrentWeek()
  }

  const handlePrint = () => {
    const originalTitle = document.title
    document.title = ''

    const restoreTitle = () => {
      document.title = originalTitle
      window.removeEventListener('afterprint', restoreTitle)
    }

    window.addEventListener('afterprint', restoreTitle)
    window.print()
  }

  const handleOpenHistory = () => {
    router.push('/history')
    setMenuOpen(false)
  }

  const handleOpenRecipes = () => {
    router.push('/recipes')
    setMenuOpen(false)
  }

  const handleBackHome = () => {
    router.push('/')
    setMenuOpen(false)
  }

  const formatMenuPeriod = (value: string): string => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      return value
    }

    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  const performSaveCurrentWeek = async () => {
    if (!selectedWeekStartDate) {
      setSaveStatus('请选择周菜单日期')
      return
    }

    const menuPeriod = formatMenuPeriod(toDateKey(selectedWeekStartDate))

    const payload = {
      menuPeriod,
      weeklyPlan,
    }

    try {
      const response = await fetch('/api/weekly-menus', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const result = (await response.json()) as { message?: string }
        throw new Error(result.message || '保存失败，请检查数据库连接')
      }

      setSaveStatus('已保存为本周菜单')
      setSaveDialogOpen(false)
      setOverlapConfirmOpen(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      setSaveStatus(normalizeClientErrorMessage(message, '保存失败，请稍后再试'))
    }
  }

  const handleConfirmSaveCurrentWeek = async () => {
    if (!menuDate) {
      setSaveStatus('请选择周菜单日期')
      return
    }

    if (hasOverlapInSelectedWeek) {
      setOverlapConfirmOpen(true)
      return
    }

    await performSaveCurrentWeek()
  }

  const handleOpenSaveDialog = () => {
    if (!hasGeneratedMenu) {
      setSaveStatus('请先生成本周菜单')
      return
    }

    setOverlapConfirmOpen(false)
    setSaveDialogOpen(true)
  }

  return (
    <div className="print-compact-root mx-auto min-h-screen max-w-md px-4 py-5 phone-container">
      <header className="print-header relative rounded-3xl border border-teal-100 bg-gradient-to-br from-teal-50 via-white to-emerald-50 p-5 shadow-sm">
        <button
          type="button"
          onClick={() => setMenuOpen((current) => !current)}
          className="print-actions absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-slate-700 shadow-sm transition hover:bg-white"
          aria-label="打开导航菜单"
          title="导航菜单"
        >
          <Menu size={16} />
        </button>

        {menuOpen ? (
          <div className="print-actions absolute right-4 top-14 z-20 w-44 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            <div className="mb-1 px-2 py-1 text-xs font-semibold text-slate-500">快速导航</div>
            <button
              type="button"
              onClick={handleBackHome}
              className="block w-full rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 transition hover:bg-slate-100"
            >
              主页面
            </button>
            <button
              type="button"
              onClick={handleOpenHistory}
              className="block w-full rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 transition hover:bg-slate-100"
            >
              过往数据
            </button>
            <button
              type="button"
              onClick={handleOpenRecipes}
              className="block w-full rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 transition hover:bg-slate-100"
            >
              菜谱库
            </button>
          </div>
        ) : null}

        <h1 className="text-center text-2xl font-extrabold tracking-tight text-slate-900">一周菜单制定表</h1>
        <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-slate-600">
          {useHistoryReference && isReferencePreparing ? <Loader2 size={14} className="animate-spin" /> : null}
          <p>
            {useHistoryReference
              ? isReferencePreparing
                ? '正在参考以往数据'
                : isReferenceReady
                  ? '已参考完成'
                  : '参考准备中'
              : '未开启参考以往数据'}
          </p>
        </div>
        {referenceStatus ? <p className="mt-1 text-center text-xs text-slate-500">{referenceStatus}</p> : null}
        <div className="print-actions mx-auto mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={!isReferenceReady}
            className="flex items-center gap-2 rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <RefreshCw size={16} />
            {hasGeneratedMenu ? '重新生成本周菜单' : '生成本周菜单'}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-white transition hover:bg-slate-800 active:scale-95"
            aria-label="打印菜单"
            title="打印菜单"
          >
            <Printer size={16} />
          </button>
        </div>
      </header>

      {!hasGeneratedMenu ? (
        <section className="print-day-list mt-4 pb-8">
          <article className="print-day-card rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
            <p className="text-sm text-slate-600">
              {isReferenceReady
                ? '参考已完成，点击上方“生成本周菜单”查看本周菜单内容。'
                : '请等待参考以往数据完成...'}
            </p>
          </article>
        </section>
      ) : (
        <section className="print-day-list mt-4 space-y-3 pb-8">
          {weeklyPlan.map((dayPlan, dayIndex) => (
          <article key={dayPlan.day} className="print-day-card rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="print-day-title text-base font-bold text-slate-900">{dayPlan.day}</h2>
            <div className="print-meal-list mt-3 space-y-3">
              {dayPlan.meals.map((meal, mealIndex) => (
                <div key={`${dayPlan.day}-${meal.label}`} className="print-meal-card rounded-xl bg-slate-50 p-3">
                  <div className="print-meal-row flex flex-col gap-2">
                    <div className="print-meal-label text-sm font-semibold text-slate-900">{meal.label}</div>
                    <div className="print-dish-grid grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                    <DishCard
                      slot="bigMeat"
                      label="大荤"
                      value={meal.bigMeat}
                      toneClassName="bg-rose-50 text-rose-700"
                      dayIndex={dayIndex}
                      mealIndex={mealIndex}
                      onReplace={handleReplaceDish}
                    />
                    <DishCard
                      slot="smallMeat"
                      label="小荤"
                      value={meal.smallMeat}
                      toneClassName="bg-amber-50 text-amber-700"
                      dayIndex={dayIndex}
                      mealIndex={mealIndex}
                      onReplace={handleReplaceDish}
                    />
                    <DishCard
                      slot="vegetable"
                      label="素菜"
                      value={meal.vegetable}
                      toneClassName="bg-emerald-50 text-emerald-700"
                      dayIndex={dayIndex}
                      mealIndex={mealIndex}
                      onReplace={handleReplaceDish}
                    />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>
          ))}
        </section>
      )}

      <section className="print-actions pb-8">
        <button
          type="button"
          onClick={handleOpenSaveDialog}
          disabled={!hasGeneratedMenu}
          className="mx-auto flex items-center gap-2 rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Save size={16} />
          保存为本周菜单
        </button>
        {saveStatus ? <p className="mt-2 text-center text-xs text-slate-600">{saveStatus}</p> : null}
      </section>

      {saveDialogOpen ? (
        <div className="print-actions fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">确认保存本周菜单</h3>

            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-xs text-slate-500">本周范围（周一到周日）</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{selectedWeekLabel}</div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setOverlapConfirmOpen(false)
                  setSaveDialogOpen(false)
                }}
                className="rounded-full bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-300"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmSaveCurrentWeek()}
                className="rounded-full bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
              >
                保存
              </button>
            </div>

            {overlapConfirmOpen ? (
              <div className="mt-3 rounded-xl border border-rose-300 bg-rose-50 p-3">
                <div className="text-sm font-semibold text-rose-800">检测到周菜单重叠</div>
                <p className="mt-1 text-xs text-rose-700">
                  本周（{selectedWeekLabel}）与历史记录重叠 {overlapDateList.length} 天。
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {overlapDateList.map((dateKey) => (
                    <span
                      key={dateKey}
                      className="rounded-full border border-rose-300 bg-white px-2 py-0.5 text-[11px] font-medium text-rose-700"
                    >
                      {formatDateKeyForDisplay(dateKey)}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOverlapConfirmOpen(false)
                      setSaveStatus('已取消保存')
                    }}
                    className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={() => void performSaveCurrentWeek()}
                    className="rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                  >
                    仍然保存
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
