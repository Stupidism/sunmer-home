'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@bubu-log/ui/card'
import { Spinner } from '@bubu-log/ui/spinner'
import { getWeekStart } from '@/lib/utils/week'

type DayEntry = {
  dayOfWeek: number
  label: string
  dishes: string[]
  ingredients: string[]
}

export function ShoppingListView() {
  const searchParams = useSearchParams()
  const weekStart = useMemo(() => {
    return searchParams.get('week') || getWeekStart(new Date())
  }, [searchParams])

  const [days, setDays] = useState<DayEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/shopping-list?week=${weekStart}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '加载失败')
        return
      }
      setDays(data.days || [])
    } catch {
      toast.error('加载失败')
    } finally {
      setLoading(false)
    }
  }, [weekStart])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  if (days.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">本周暂无计划，无法生成购物清单</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {days.map((day) => (
        <Card key={day.dayOfWeek} className="animate-fade-in">
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-sm font-semibold">{day.label}</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="space-y-0.5">
              {day.ingredients.map((ing) => (
                <div key={ing} className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">·</span>
                  <span>{ing}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {day.dishes.join('、')}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
