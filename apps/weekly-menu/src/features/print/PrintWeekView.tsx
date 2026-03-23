'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getWeekStart } from '@/lib/utils/week'
import { Button } from '@bubu-log/ui/button'
import { Checkbox } from '@bubu-log/ui/checkbox'
import { Spinner } from '@bubu-log/ui/spinner'
import { Printer, ArrowLeft } from 'lucide-react'

const dayLabels = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']
const mealLabels = { LUNCH: '午餐', DINNER: '晚餐' } as const

type Slot = {
  dayOfWeek: number
  mealType: string
  dishes: { name: string; category: string }[]
}

type DayEntry = {
  dayOfWeek: number
  label: string
  dishes: string[]
  ingredients: string[]
}

export function PrintWeekView() {
  const searchParams = useSearchParams()
  const weekStart = useMemo(
    () => searchParams.get('week') || getWeekStart(new Date()),
    [searchParams],
  )

  const [slots, setSlots] = useState<Slot[]>([])
  const [days, setDays] = useState<DayEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [includeShoppingList, setIncludeShoppingList] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [planRes, listRes] = await Promise.all([
        fetch(`/api/weekly-plan?week=${weekStart}`),
        fetch(`/api/shopping-list?week=${weekStart}`),
      ])
      const planData = await planRes.json()
      const listData = await listRes.json()

      setSlots(planData.slots || [])
      setDays(listData.days || [])
    } catch {
      setSlots([])
      setDays([])
    } finally {
      setLoading(false)
    }
  }, [weekStart])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const formatWeekRange = (start: string) => {
    const d = new Date(start + 'T00:00:00')
    const end = new Date(d)
    end.setDate(end.getDate() + 6)
    return `${d.getMonth() + 1}月${d.getDate()}日–${end.getMonth() + 1}月${end.getDate()}日`
  }

  const slotsByDay = useMemo(() => {
    const map = new Map<number, { lunch: Slot | null; dinner: Slot | null }>()
    for (let d = 1; d <= 7; d++) {
      map.set(d, { lunch: null, dinner: null })
    }
    for (const s of slots) {
      const entry = map.get(s.dayOfWeek)!
      if (s.mealType === 'LUNCH') entry.lunch = s
      else entry.dinner = s
    }
    return map
  }, [slots])

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  if (slots.length === 0) {
    return (
      <div className="space-y-4">
        <Link href={`/?week=${weekStart}`}>
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            返回
          </Button>
        </Link>
        <p className="text-center text-muted-foreground py-12">
          该周暂无计划，无法打印
        </p>
      </div>
    )
  }

  return (
    <div className="print-view">
      {/* 屏幕操作区 - 打印时隐藏 */}
      <div className="space-y-3 mb-4 print:hidden">
        <div className="flex items-center justify-between gap-2">
          <Link href={`/?week=${weekStart}`}>
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              返回
            </Button>
          </Link>
          <Button onClick={handlePrint} className="gap-1.5">
            <Printer className="h-4 w-4" />
            打印
          </Button>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <Checkbox
            checked={includeShoppingList}
            onCheckedChange={(checked) =>
              setIncludeShoppingList(checked === true)
            }
          />
          <span>打印时包含购物清单</span>
        </label>
      </div>

      {/* 打印内容 - 紧凑布局适配 A4 */}
      <div className="print:pt-0 print:max-w-none">
        <h1 className="text-lg font-bold mb-3 print:text-sm print:mb-1.5 print:leading-tight">
          周菜单 {formatWeekRange(weekStart)}
        </h1>

        {/* 周网格 - 打印时紧凑表格布局 */}
        <div className="space-y-2 mb-6 print:space-y-0 print:mb-2">
          {[1, 2, 3, 4, 5, 6, 7].map((day) => {
            const { lunch, dinner } = slotsByDay.get(day)!
            return (
              <div
                key={day}
                className="border border-border rounded-lg p-2.5 print:border print:border-gray-300 print:rounded-none print:p-1 print:mb-0.5 print:break-inside-avoid"
              >
                <div className="font-medium text-sm mb-1 print:text-[10px] print:mb-0.5 print:leading-tight">
                  {dayLabels[day]}
                </div>
                <div className="grid grid-cols-2 gap-2 print:gap-1">
                  <div className="print:min-w-0">
                    <span className="text-muted-foreground text-xs print:text-[9px]">
                      {mealLabels.LUNCH}
                    </span>
                    <div className="mt-0.5 print:mt-0">
                      {lunch?.dishes?.length
                        ? lunch.dishes.map((d, i) => (
                            <div key={i} className="flex items-center gap-1 print:gap-0.5 print:leading-tight print:text-[9px]">
                              <span className="text-[10px] text-muted-foreground print:text-[8px] shrink-0">
                                [{d.category === 'MEAT' ? '荤' : d.category === 'LEAFY_GREEN' ? '素' : '其他'}]
                              </span>
                              <span className="truncate print:whitespace-normal print:overflow-visible">{d.name}</span>
                            </div>
                          ))
                        : '—'}
                    </div>
                  </div>
                  <div className="print:min-w-0">
                    <span className="text-muted-foreground text-xs print:text-[9px]">
                      {mealLabels.DINNER}
                    </span>
                    <div className="mt-0.5 print:mt-0">
                      {dinner?.dishes?.length ? (
                        dinner.dishes.map((d, i) => (
                          <div key={i} className="flex items-center gap-1 print:gap-0.5 print:leading-tight print:text-[9px]">
                            <span className="text-[10px] text-muted-foreground print:text-[8px] shrink-0">
                              [{d.category === 'MEAT' ? '荤' : d.category === 'LEAFY_GREEN' ? '素' : '其他'}]
                            </span>
                            <span className="truncate print:whitespace-normal print:overflow-visible">{d.name}</span>
                          </div>
                        ))
                      ) : (
                        '—'
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* 购物清单附页 - 可选，打印时更紧凑 */}
        {includeShoppingList && (
          <>
            <h2 className="text-base font-bold mb-2 print:text-[10px] print:mb-1">
              购物清单
            </h2>
            <div className="space-y-1.5 print:space-y-0.5 print:text-[9px]">
              {days.map((day) => (
                <div
                  key={day.dayOfWeek}
                  className="border-b border-border/50 pb-1.5 print:pb-0.5 print:border-gray-200"
                >
                  <div className="font-medium text-sm print:text-[9px] print:leading-tight">
                    {day.label}
                  </div>
                  <div className="text-muted-foreground mt-0.5 print:mt-0 print:leading-tight">
                    {day.ingredients.length > 0
                      ? day.ingredients.join('、')
                      : '—'}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

    </div>
  )
}
