'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { Button } from '@bubu-log/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@bubu-log/ui/popover'
import { Calendar } from '@bubu-log/ui/calendar'
import { getWeekStart } from '@/lib/utils/week'

function formatWeekRange(weekStart: string) {
  const d = new Date(weekStart + 'T00:00:00')
  const end = new Date(d)
  end.setDate(end.getDate() + 6)

  const startMonth = d.getMonth() + 1
  const startDay = d.getDate()
  const endMonth = end.getMonth() + 1
  const endDay = end.getDate()

  if (startMonth === endMonth) {
    return `${startMonth}月${startDay}日–${endDay}日`
  }
  return `${startMonth}月${startDay}日–${endMonth}月${endDay}日`
}

export function WeekSwitcher() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [calOpen, setCalOpen] = useState(false)

  const weekStart = useMemo(() => {
    const param = searchParams.get('week')
    if (param) return param
    return getWeekStart(new Date())
  }, [searchParams])

  const navigate = (weekStartDate: string) => {
    router.push(`/?week=${weekStartDate}`)
  }

  const goPrev = () => {
    const d = new Date(weekStart + 'T00:00:00')
    d.setDate(d.getDate() - 7)
    navigate(getWeekStart(d))
  }

  const goNext = () => {
    const d = new Date(weekStart + 'T00:00:00')
    d.setDate(d.getDate() + 7)
    navigate(getWeekStart(d))
  }

  const onCalSelect = (date: Date | undefined) => {
    if (!date) return
    navigate(getWeekStart(date))
    setCalOpen(false)
  }

  return (
    <div className="flex items-center justify-between gap-2 py-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={goPrev}
        aria-label="上一周"
        className="active:scale-95 active:opacity-80"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>

      <Popover open={calOpen} onOpenChange={setCalOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className="flex items-center gap-1.5 text-sm font-medium active:scale-95 active:opacity-80"
          >
            <CalendarDays className="h-4 w-4" />
            {formatWeekRange(weekStart)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="center">
          <Calendar
            mode="single"
            selected={new Date(weekStart + 'T00:00:00')}
            onSelect={onCalSelect}
            weekStartsOn={1}
          />
        </PopoverContent>
      </Popover>

      <Button
        variant="ghost"
        size="icon"
        onClick={goNext}
        aria-label="下一周"
        className="active:scale-95 active:opacity-80"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  )
}
