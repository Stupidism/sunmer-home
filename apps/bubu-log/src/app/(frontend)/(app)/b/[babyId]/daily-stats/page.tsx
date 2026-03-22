'use client'

import { useState, useMemo, useCallback, Suspense } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { dayjs, formatDateChinese } from '@/lib/dayjs'
import { useDailyStats, useComputeDailyStat, useActivities, type DailyStat, type Activity } from '@/lib/api/hooks'
import { toast } from 'sonner'
import {
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Moon,
  Milk,
  Baby,
  Calendar,
  BarChart3,
  CalendarDays,
} from 'lucide-react'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@bubu-log/ui'
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts'
import { AppDrawerMenu } from '@/components/AppDrawerMenu'
import { BackHomeButton } from '@/components/BackHomeButton'
import { buildBabyScopedPath } from '@/lib/baby-scope'

// Tab 类型
type TabType = 'chart' | 'weekly' | 'monthly'

// 图表配置
const sleepChartConfig = {
  totalSleepMinutes: {
    label: '睡眠时长',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig

const feedingChartConfig = {
  totalMilkAmount: {
    label: '宝宝奶量',
    color: 'hsl(var(--chart-2))',
  },
  totalPumpMilkAmount: {
    label: '妈妈吸奶量',
    color: 'hsl(var(--chart-4))',
  },
} satisfies ChartConfig

const diaperChartConfig = {
  diaperCount: {
    label: '换尿布',
    color: 'hsl(var(--chart-3))',
  },
} satisfies ChartConfig

// 格式化分钟为小时（紧凑格式，用于小空间）
function formatMinutesToHoursCompact(minutes: number): { hours: string; mins: string } | string {
  if (minutes === 0) return '-'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return { hours: `${hours}h`, mins: `${mins}m` }
}

// 格式化分钟为小时
function formatMinutesToHours(minutes: number): string {
  if (minutes === 0) return '0h'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h${mins}m`
}

// 获取颜色强度 (0-4)
function getIntensity(value: number, max: number): number {
  if (value === 0) return 0
  const ratio = value / max
  if (ratio < 0.25) return 1
  if (ratio < 0.5) return 2
  if (ratio < 0.75) return 3
  return 4
}

// 活动类型颜色映射
const activityColors: Record<string, string> = {
  SLEEP: 'bg-sky-400',
  BREASTFEED: 'bg-rose-300',
  BOTTLE: 'bg-pink-400',
  PUMP: 'bg-fuchsia-400',
  DIAPER: 'bg-yellow-400',
  HEAD_LIFT: 'bg-amber-400',
  PASSIVE_EXERCISE: 'bg-orange-400',
  GAS_EXERCISE: 'bg-amber-300',
  BATH: 'bg-yellow-300',
  OUTDOOR: 'bg-amber-500',
  EARLY_EDUCATION: 'bg-orange-300',
  SUPPLEMENT: 'bg-yellow-400',
  SPIT_UP: 'bg-red-400',
}

const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const weekdaysShort = ['一', '二', '三', '四', '五', '六', '日']

// 周历视图的活动分类筛选
type WeeklyFilterCategory = 'sleep' | 'feeding' | 'diaper' | 'exercise'

const weeklyFilterCategories: Array<{ key: WeeklyFilterCategory; label: string; types: string[]; color: string; bgColor: string }> = [
  { key: 'sleep', label: '睡眠', types: ['SLEEP'], color: 'bg-sky-400', bgColor: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  { key: 'feeding', label: '喂奶', types: ['BREASTFEED', 'BOTTLE', 'PUMP'], color: 'bg-pink-400', bgColor: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300' },
  { key: 'diaper', label: '换尿布', types: ['DIAPER'], color: 'bg-yellow-400', bgColor: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' },
  { key: 'exercise', label: '运动', types: ['HEAD_LIFT', 'PASSIVE_EXERCISE', 'GAS_EXERCISE', 'BATH', 'OUTDOOR', 'EARLY_EDUCATION'], color: 'bg-amber-400', bgColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
]

// ==================== 折线图视图 ====================
function ChartView({
  chartData,
  daysToShow,
  setDaysToShow,
}: {
  chartData: Array<{ date: string; dateLabel: string; totalSleepMinutes: number; totalMilkAmount: number; totalPumpMilkAmount: number; diaperCount: number; hasData: boolean }>
  daysToShow: number
  setDaysToShow: (days: number) => void
}) {
  return (
    <div className="space-y-6">
      {/* 天数选择 */}
      <div className="flex justify-center gap-2">
        {[7, 14, 30].map(days => (
          <button
            key={days}
            onClick={() => setDaysToShow(days)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${daysToShow === days
              ? 'bg-primary text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}
          >
            {days}天
          </button>
        ))}
      </div>

      {/* 睡眠趋势 */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Moon size={20} className="text-sky-500" />
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">睡眠趋势</h2>
        </div>
        <ChartContainer config={sleepChartConfig} className="h-[200px] md:h-[300px] w-full">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} stroke="#9ca3af" />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => formatMinutesToHours(value)} stroke="#9ca3af" />
            <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatMinutesToHours(value as number)} />} />
            <Line type="linear" dataKey="totalSleepMinutes" stroke="#0ea5e9" strokeWidth={2} dot={{ fill: '#0ea5e9', r: 3 }} activeDot={{ r: 5 }} connectNulls />
          </LineChart>
        </ChartContainer>
      </section>

      {/* 奶量趋势 */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Milk size={20} className="text-pink-500" />
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">奶量趋势</h2>
        </div>
        <ChartContainer config={feedingChartConfig} className="h-[200px] md:h-[300px] w-full">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} stroke="#9ca3af" />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `${value}ml`} stroke="#9ca3af" />
            <ChartTooltip content={<ChartTooltipContent />} />
            {/* 宝宝摄入奶量 - 粉色 */}
            <Line type="linear" dataKey="totalMilkAmount" stroke="#ec4899" strokeWidth={2} dot={{ fill: '#ec4899', r: 3 }} activeDot={{ r: 5 }} connectNulls />
            {/* 妈妈吸奶量 - 洋红 */}
            <Line type="linear" dataKey="totalPumpMilkAmount" stroke="#d946ef" strokeWidth={2} dot={{ fill: '#d946ef', r: 3 }} activeDot={{ r: 5 }} connectNulls />
          </LineChart>
        </ChartContainer>
      </section>

      {/* 换尿布趋势 */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Baby size={20} className="text-yellow-500" />
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">换尿布趋势</h2>
        </div>
        <ChartContainer config={diaperChartConfig} className="h-[200px] md:h-[300px] w-full">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} stroke="#9ca3af" />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `${value}次`} stroke="#9ca3af" />
            <ChartTooltip content={<ChartTooltipContent formatter={(value) => `${value}次`} />} />
            <Line type="linear" dataKey="diaperCount" stroke="#eab308" strokeWidth={2} dot={{ fill: '#eab308', r: 3 }} activeDot={{ r: 5 }} connectNulls />
          </LineChart>
        </ChartContainer>
      </section>

      {/* 缺失数据提示 */}
      {chartData.some(d => !d.hasData) && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 text-center">
          <p className="text-yellow-700 dark:text-yellow-400 text-sm">
            部分日期缺少统计数据，点击右上角刷新按钮批量计算
          </p>
        </div>
      )}
    </div>
  )
}

// 活动块类型（用于跨天活动渲染）
type ActivityBlock = {
  activity: Activity
  startPercent: number
  endPercent: number
}

// ==================== 周历视图（真正的周视图：7列，每列一天，从早到晚的活动色块） ====================
function WeeklyView({
  weekStart,
  onNavigate,
  canGoForward,
}: {
  weekStart: Date
  onNavigate: (direction: number) => void
  canGoForward: boolean
}) {
  // 活动分类筛选（默认全选）
  const [selectedFilters, setSelectedFilters] = useState<Set<WeeklyFilterCategory>>(
    () => new Set(['sleep', 'feeding', 'diaper', 'exercise'])
  )

  const toggleFilter = useCallback((category: WeeklyFilterCategory) => {
    setSelectedFilters(prev => {
      const next = new Set(prev)
      if (next.has(category)) {
        // 至少保留一个选中
        if (next.size > 1) next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }, [])

  // 根据选中分类得到允许的活动类型集合
  const allowedTypes = useMemo(() => {
    const types = new Set<string>()
    for (const cat of weeklyFilterCategories) {
      if (selectedFilters.has(cat.key)) {
        cat.types.forEach(t => types.add(t))
      }
    }
    return types
  }, [selectedFilters])

  // 获取一周的日期范围
  const weekDates = useMemo(() => {
    const dates: string[] = []
    for (let i = 0; i < 7; i++) {
      dates.push(dayjs(weekStart).add(i, 'day').format('YYYY-MM-DD'))
    }
    return dates
  }, [weekStart])

  const startDateForQuery = useMemo(() => {
    return dayjs(weekDates[0]).startOf('day').toISOString()
  }, [weekDates])

  const endDateForQuery = useMemo(() => {
    return dayjs(weekDates[6]).endOf('day').toISOString()
  }, [weekDates])

  // 获取这一周的所有活动（包括跨天活动）
  // crossStartTime: 包含开始时间早于周一但结束时间在本周内的活动（如周日晚睡到周一早醒）
  // crossEndTime: 包含开始时间在本周内但结束时间超过周日的活动（如周日晚睡还没醒）
  const { data: activitiesData = [], isLoading } = useActivities({
    startTimeGte: startDateForQuery,
    startTimeLt: endDateForQuery,
    crossStartTime: true,
    crossEndTime: true,
    limit: 1000, // 增加 limit 以获取一周的所有活动
  })

  // 按日期分组活动（处理跨天活动）
  const activitiesByDate = useMemo(() => {
    const map = new Map<string, ActivityBlock[]>()
    weekDates.forEach(date => map.set(date, []))

    activitiesData.filter((a: Activity) => allowedTypes.has(a.type)).forEach((activity: Activity) => {
      const activityStart = dayjs(activity.startTime)
      const activityEnd = activity.endTime ? dayjs(activity.endTime) : activityStart
      const startDate = activityStart.format('YYYY-MM-DD')
      const endDate = activityEnd.format('YYYY-MM-DD')

      // 遍历这个活动涉及的每一天
      weekDates.forEach(date => {
        const dayStart = dayjs(date).startOf('day')
        const dayEnd = dayjs(date).endOf('day')

        // 检查活动是否与这一天有交集
        if (activityStart.isBefore(dayEnd) && activityEnd.isAfter(dayStart)) {
          // 计算在这一天内的时间范围
          const effectiveStart = activityStart.isBefore(dayStart) ? dayStart : activityStart
          const effectiveEnd = activityEnd.isAfter(dayEnd) ? dayEnd : activityEnd

          const startMinutes = effectiveStart.hour() * 60 + effectiveStart.minute()
          const endMinutes = effectiveEnd.hour() * 60 + effectiveEnd.minute()

          // 如果跨到第二天凌晨，endMinutes 应该是 24*60
          const adjustedEndMinutes = date === endDate ? endMinutes : 24 * 60
          const adjustedStartMinutes = date === startDate ? startMinutes : 0

          const startPercent = (adjustedStartMinutes / (24 * 60)) * 100
          const endPercent = (adjustedEndMinutes / (24 * 60)) * 100

          // 对于瞬时事件（如换尿布），endPercent == startPercent，给一个最小高度
          const minBlockPercent = 0.5 // 约7分钟的高度
          const adjustedEndPercent = endPercent <= startPercent ? startPercent + minBlockPercent : endPercent
          if (adjustedEndPercent > startPercent) {
            map.get(date)!.push({
              activity,
              startPercent,
              endPercent: adjustedEndPercent,
            })
          }
        }
      })
    })

    // 按开始位置排序
    map.forEach((blocks) => {
      blocks.sort((a, b) => a.startPercent - b.startPercent)
    })

    return map
  }, [activitiesData, weekDates, allowedTypes])

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">加载中...</div>
  }

  return (
    <div className="space-y-4">
      {/* 周导航 */}
      <div className="flex items-center justify-between px-2">
        <button
          onClick={() => onNavigate(-1)}
          className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
        >
          <ChevronLeft size={20} />
        </button>
        <p className="text-base font-bold text-gray-800 dark:text-gray-100">
          {dayjs(weekStart).format('M月D日')} - {dayjs(weekStart).add(6, 'day').format('M月D日')}
        </p>
        <button
          onClick={() => onNavigate(1)}
          disabled={!canGoForward}
          className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-50"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* 周历表格 */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
        {/* 表头 */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDates.map((date, i) => {
            const isToday = date === dayjs().format('YYYY-MM-DD')
            return (
              <div key={date} className="text-center">
                <div className="text-xs text-gray-500">{weekdaysShort[i]}</div>
                <div className={`text-sm font-bold ${isToday ? 'text-primary' : 'text-gray-800 dark:text-gray-100'}`}>
                  {dayjs(date).format('D')}
                </div>
              </div>
            )
          })}
        </div>

        {/* 时间轴和活动块 */}
        <div className="grid grid-cols-7 gap-1">
          {weekDates.map((date) => {
            const blocks = activitiesByDate.get(date) || []
            const isFuture = dayjs(date).isAfter(dayjs(), 'day')
            const isToday = date === dayjs().format('YYYY-MM-DD')

            return (
              <div
                key={date}
                className={`relative h-[300px] md:h-[500px] lg:h-[600px] rounded-lg ${isFuture
                  ? 'bg-gray-50 dark:bg-gray-900'
                  : 'bg-gray-100 dark:bg-gray-700'
                  } ${isToday ? 'ring-2 ring-primary' : ''}`}
              >
                {/* 时间刻度线 */}
                {[6, 12, 18].map(hour => (
                  <div
                    key={hour}
                    className="absolute left-0 right-0 border-t border-gray-200 dark:border-gray-600 opacity-50"
                    style={{ top: `${(hour / 24) * 100}%` }}
                  >
                    <span className="absolute -top-2 left-0 text-[8px] text-gray-400">
                      {hour}
                    </span>
                  </div>
                ))}

                {/* 活动色块 */}
                {blocks.map((block, idx) => {
                  const colorClass = activityColors[block.activity.type] || 'bg-gray-400'
                  const heightPercent = block.endPercent - block.startPercent

                  return (
                    <div
                      key={`${block.activity.id}-${date}-${idx}`}
                      className={`absolute left-0.5 right-0.5 ${colorClass} rounded-sm opacity-80`}
                      style={{
                        top: `${block.startPercent}%`,
                        height: `${heightPercent}%`,
                        minHeight: '4px'
                      }}
                      title={`${block.activity.type} - ${dayjs(block.activity.startTime).format('HH:mm')}${block.activity.endTime ? ` ~ ${dayjs(block.activity.endTime).format('HH:mm')}` : ''}`}
                    />
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* 可交互的分类筛选 */}
        <div className="flex flex-wrap gap-2 mt-4 justify-center">
          {weeklyFilterCategories.map(cat => {
            const isSelected = selectedFilters.has(cat.key)
            return (
              <button
                key={cat.key}
                onClick={() => toggleFilter(cat.key)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  isSelected
                    ? cat.bgColor + ' ring-1 ring-current'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-sm ${isSelected ? cat.color : 'bg-gray-300 dark:bg-gray-600'}`} />
                {cat.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ==================== 月历视图（原周历视图：4周热力图） ====================
function MonthlyView({
  weeksData,
  maxValues,
  onNavigate,
  canGoForward,
  weeksToShow,
  activitiesPath,
}: {
  weeksData: Array<{
    weekLabel: string
    weekStart: string
    days: Array<{ date: string; dayOfWeek: number; stat: DailyStat | null }>
  }>
  maxValues: { sleep: number; milk: number }
  onNavigate: (direction: number) => void
  canGoForward: boolean
  weeksToShow: number
  activitiesPath: string
}) {
  const router = useRouter()

  // 点击日期跳转到统计页，带上日期和过滤类型
  const handleDateClick = useCallback((date: string, filterType: 'sleep' | 'feeding') => {
    const params = new URLSearchParams()
    params.set('date', date)
    params.set('filter', filterType)
    router.push(`${activitiesPath}?${params.toString()}`)
  }, [activitiesPath, router])
  return (
    <div className="space-y-6">
      {/* 周导航 */}
      <div className="flex items-center justify-between px-2">
        <button
          onClick={() => onNavigate(-1)}
          className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
        >
          <ChevronLeft size={20} />
        </button>
        <p className="text-base font-bold text-gray-800 dark:text-gray-100">
          最近 {weeksToShow} 周
        </p>
        <button
          onClick={() => onNavigate(1)}
          disabled={!canGoForward}
          className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-50"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* 睡眠热力图 */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Moon size={20} className="text-sky-500" />
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">睡眠</h2>
        </div>

        {/* 表头 */}
        <div className="grid grid-cols-8 gap-1 mb-2">
          <div className="text-xs text-gray-400 text-right pr-1"></div>
          {weekdays.map((day, i) => (
            <div key={i} className="text-xs text-gray-500 text-center font-medium">
              {day}
            </div>
          ))}
        </div>

        {/* 周数据 */}
        {weeksData.map((week) => (
          <div key={week.weekStart} className="grid grid-cols-8 gap-1 mb-1">
            <div className="text-xs text-gray-400 text-right pr-1 self-center">
              {dayjs(week.weekStart).format('M/D')}
            </div>
            {week.days.map((day) => {
              const intensity = day.stat
                ? getIntensity(day.stat.totalSleepMinutes ?? 0, maxValues.sleep)
                : 0
              const isToday = day.date === dayjs().format('YYYY-MM-DD')
              const isFuture = dayjs(day.date).isAfter(dayjs(), 'day')
              const formatted = day.stat ? formatMinutesToHoursCompact(day.stat.totalSleepMinutes ?? 0) : ''

              return (
                <button
                  key={day.date}
                  onClick={() => !isFuture && handleDateClick(day.date, 'sleep')}
                  className={`
                    aspect-square rounded-md flex flex-col items-center justify-center text-[10px] font-medium leading-tight p-0.5
                    ${isFuture ? 'bg-gray-50 dark:bg-gray-900 text-gray-300 dark:text-gray-700 cursor-default' : 'cursor-pointer hover:ring-2 hover:ring-sky-300 hover:ring-offset-1'}
                    ${!isFuture && intensity === 0 ? 'bg-gray-100 dark:bg-gray-700 text-gray-400' : ''}
                    ${!isFuture && intensity === 1 ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400' : ''}
                    ${!isFuture && intensity === 2 ? 'bg-sky-200 dark:bg-sky-800/40 text-sky-700 dark:text-sky-300' : ''}
                    ${!isFuture && intensity === 3 ? 'bg-sky-300 dark:bg-sky-700/50 text-sky-800 dark:text-sky-200' : ''}
                    ${!isFuture && intensity === 4 ? 'bg-sky-400 dark:bg-sky-600/60 text-white' : ''}
                    ${isToday ? 'ring-2 ring-primary ring-offset-1' : ''}
                  `}
                  title={`${day.date}: ${day.stat ? formatMinutesToHours(day.stat.totalSleepMinutes ?? 0) : '无数据'}`}
                  disabled={isFuture}
                >
                  {!isFuture && formatted && typeof formatted === 'object' ? (
                    <>
                      <span>{formatted.hours}</span>
                      <span>{formatted.mins}</span>
                    </>
                  ) : (
                    <span>{formatted as string}</span>
                  )}
                </button>
              )
            })}
          </div>
        ))}

        {/* 图例 */}
        <div className="flex items-center justify-end gap-2 mt-3">
          <span className="text-xs text-gray-400">少</span>
          <div className="w-4 h-4 rounded bg-sky-100 dark:bg-sky-900/30"></div>
          <div className="w-4 h-4 rounded bg-sky-200 dark:bg-sky-800/40"></div>
          <div className="w-4 h-4 rounded bg-sky-300 dark:bg-sky-700/50"></div>
          <div className="w-4 h-4 rounded bg-sky-400 dark:bg-sky-600/60"></div>
          <span className="text-xs text-gray-400">多</span>
        </div>
      </section>

      {/* 奶量热力图 */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Milk size={20} className="text-pink-500" />
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">奶量</h2>
        </div>

        {/* 表头 */}
        <div className="grid grid-cols-8 gap-1 mb-2">
          <div className="text-xs text-gray-400 text-right pr-1"></div>
          {weekdays.map((day, i) => (
            <div key={i} className="text-xs text-gray-500 text-center font-medium">
              {day}
            </div>
          ))}
        </div>

        {/* 周数据 */}
        {weeksData.map((week) => (
          <div key={week.weekStart} className="grid grid-cols-8 gap-1 mb-1">
            <div className="text-xs text-gray-400 text-right pr-1 self-center">
              {dayjs(week.weekStart).format('M/D')}
            </div>
            {week.days.map((day) => {
              const intensity = day.stat
                ? getIntensity(day.stat.totalMilkAmount ?? 0, maxValues.milk)
                : 0
              const isToday = day.date === dayjs().format('YYYY-MM-DD')
              const isFuture = dayjs(day.date).isAfter(dayjs(), 'day')

              return (
                <button
                  key={day.date}
                  onClick={() => !isFuture && handleDateClick(day.date, 'feeding')}
                  className={`
                    aspect-square rounded-md flex items-center justify-center text-[10px] font-medium
                    ${isFuture ? 'bg-gray-50 dark:bg-gray-900 text-gray-300 dark:text-gray-700 cursor-default' : 'cursor-pointer hover:ring-2 hover:ring-pink-300 hover:ring-offset-1'}
                    ${!isFuture && intensity === 0 ? 'bg-gray-100 dark:bg-gray-700 text-gray-400' : ''}
                    ${!isFuture && intensity === 1 ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400' : ''}
                    ${!isFuture && intensity === 2 ? 'bg-pink-200 dark:bg-pink-800/40 text-pink-700 dark:text-pink-300' : ''}
                    ${!isFuture && intensity === 3 ? 'bg-pink-300 dark:bg-pink-700/50 text-pink-800 dark:text-pink-200' : ''}
                    ${!isFuture && intensity === 4 ? 'bg-pink-400 dark:bg-pink-600/60 text-white' : ''}
                    ${isToday ? 'ring-2 ring-primary ring-offset-1' : ''}
                  `}
                  title={`${day.date}: ${day.stat ? `${day.stat.totalMilkAmount ?? 0}ml` : '无数据'}`}
                  disabled={isFuture}
                >
                  {!isFuture && day.stat && (day.stat.totalMilkAmount ?? 0) > 0
                    ? `${day.stat.totalMilkAmount}`
                    : ''}
                </button>
              )
            })}
          </div>
        ))}

        {/* 图例 */}
        <div className="flex items-center justify-end gap-2 mt-3">
          <span className="text-xs text-gray-400">少</span>
          <div className="w-4 h-4 rounded bg-pink-100 dark:bg-pink-900/30"></div>
          <div className="w-4 h-4 rounded bg-pink-200 dark:bg-pink-800/40"></div>
          <div className="w-4 h-4 rounded bg-pink-300 dark:bg-pink-700/50"></div>
          <div className="w-4 h-4 rounded bg-pink-400 dark:bg-pink-600/60"></div>
          <span className="text-xs text-gray-400">多</span>
        </div>
      </section>

      {/* 缺失数据提示 */}
      {weeksData.some(week => week.days.some(d => !d.stat && !dayjs(d.date).isAfter(dayjs(), 'day'))) && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 text-center">
          <p className="text-yellow-700 dark:text-yellow-400 text-sm">
            部分日期缺少统计数据，点击右上角刷新按钮批量计算
          </p>
        </div>
      )}
    </div>
  )
}

// ==================== 主页面组件 ====================
function DailyStatsPageContent() {
  const routeParams = useParams<{ babyId: string }>()
  const babyId = routeParams?.babyId || ''
  const activitiesPath = buildBabyScopedPath(babyId, '/activities')
  const [activeTab, setActiveTab] = useState<TabType>('chart')
  const [daysToShow, setDaysToShow] = useState(7)
  const [endDate, setEndDate] = useState(() => dayjs().startOf('day').toDate())
  // 使用 weekday(0) 获取本周周一 (zh-cn locale 下 weekday(0) = 周一)
  const [weeklyViewWeekStart, setWeeklyViewWeekStart] = useState(() =>
    dayjs().weekday(0).startOf('day').toDate()
  )
  const [monthlyViewWeekStart, setMonthlyViewWeekStart] = useState(() =>
    dayjs().weekday(0).startOf('day').toDate()
  )
  const weeksToShow = 4

  // 图表视图的日期范围
  const chartStartDate = useMemo(() => {
    return dayjs(endDate).subtract(daysToShow - 1, 'day').toDate()
  }, [endDate, daysToShow])

  const chartStartDateStr = dayjs(chartStartDate).format('YYYY-MM-DD')
  const chartEndDateStr = dayjs(endDate).format('YYYY-MM-DD')

  // 月历视图的日期范围
  const monthlyDateRange = useMemo(() => {
    const startDate = dayjs(monthlyViewWeekStart).subtract(weeksToShow - 1, 'week')
    const endDateVal = dayjs(monthlyViewWeekStart).add(6, 'day')
    return {
      start: startDate.format('YYYY-MM-DD'),
      end: endDateVal.format('YYYY-MM-DD'),
    }
  }, [monthlyViewWeekStart, weeksToShow])

  // 获取图表统计数据
  const { data: chartStats = [], isLoading: chartLoading, refetch: refetchChart } = useDailyStats({
    startDate: chartStartDateStr,
    endDate: chartEndDateStr,
  })

  // 获取月历统计数据
  const { data: monthlyStats = [], isLoading: monthlyLoading, refetch: refetchMonthly } = useDailyStats({
    startDate: monthlyDateRange.start,
    endDate: monthlyDateRange.end,
  })

  const computeMutation = useComputeDailyStat()

  // 图表日期范围
  const chartDateRange = useMemo(() => {
    const dates: string[] = []
    let current = dayjs(chartStartDate)
    const end = dayjs(endDate)
    while (current.isBefore(end) || current.isSame(end, 'day')) {
      dates.push(current.format('YYYY-MM-DD'))
      current = current.add(1, 'day')
    }
    return dates
  }, [chartStartDate, endDate])

  // 图表数据
  const chartData = useMemo(() => {
    const statsByDate = new Map(
      chartStats.map(s => [dayjs(s.date).format('YYYY-MM-DD'), s])
    )

    return chartDateRange.map(date => {
      const stat = statsByDate.get(date)
      return {
        date,
        dateLabel: dayjs(date).format('M/D'),
        totalSleepMinutes: stat?.totalSleepMinutes ?? 0,
        totalMilkAmount: stat?.totalMilkAmount ?? 0,
        totalPumpMilkAmount: stat?.totalPumpMilkAmount ?? 0,
        diaperCount: stat?.diaperCount ?? 0,
        hasData: !!stat,
      }
    })
  }, [chartDateRange, chartStats])

  // 月历周数据
  const weeksData = useMemo(() => {
    const statsByDate = new Map(
      monthlyStats.map(s => [dayjs(s.date).format('YYYY-MM-DD'), s])
    )

    const weeks: Array<{
      weekLabel: string
      weekStart: string
      days: Array<{ date: string; dayOfWeek: number; stat: DailyStat | null }>
    }> = []

    for (let w = weeksToShow - 1; w >= 0; w--) {
      const weekStart = dayjs(monthlyViewWeekStart).subtract(w, 'week')
      const weekLabel = weekStart.format('M/D') + ' - ' + weekStart.add(6, 'day').format('M/D')

      const days = []
      for (let d = 0; d < 7; d++) {
        const date = weekStart.add(d, 'day').format('YYYY-MM-DD')
        days.push({
          date,
          dayOfWeek: d,
          stat: statsByDate.get(date) || null,
        })
      }

      weeks.push({ weekLabel, weekStart: weekStart.format('YYYY-MM-DD'), days })
    }

    return weeks
  }, [monthlyViewWeekStart, weeksToShow, monthlyStats])

  // 月历最大值
  const monthlyMaxValues = useMemo(() => {
    let maxSleep = 0
    let maxMilk = 0

    for (const stat of monthlyStats) {
      maxSleep = Math.max(maxSleep, stat.totalSleepMinutes ?? 0)
      maxMilk = Math.max(maxMilk, stat.totalMilkAmount ?? 0)
    }

    return {
      sleep: maxSleep || 12 * 60,
      milk: maxMilk || 600,
    }
  }, [monthlyStats])

  // 导航日期范围（图表）
  const navigateChartDays = (direction: number) => {
    setEndDate(prev => dayjs(prev).add(direction * daysToShow, 'day').toDate())
  }

  // 导航周（周历）
  const navigateWeeklyWeek = (direction: number) => {
    setWeeklyViewWeekStart(prev => dayjs(prev).add(direction, 'week').toDate())
  }

  // 导航周（月历）
  const navigateMonthlyWeek = (direction: number) => {
    setMonthlyViewWeekStart(prev => dayjs(prev).add(direction, 'week').toDate())
  }

  // 刷新当前视图的数据
  const handleRefresh = useCallback(async () => {
    try {
      let datesToCompute: string[] = []

      if (activeTab === 'chart') {
        datesToCompute = chartDateRange
      } else if (activeTab === 'weekly') {
        for (let i = 0; i < 7; i++) {
          datesToCompute.push(dayjs(weeklyViewWeekStart).add(i, 'day').format('YYYY-MM-DD'))
        }
      } else {
        weeksData.forEach(week => {
          week.days.forEach(day => {
            datesToCompute.push(day.date)
          })
        })
      }

      for (const date of datesToCompute) {
        await computeMutation.mutateAsync({ body: { date } })
      }

      toast.success(`已重新计算 ${datesToCompute.length} 天的统计数据`)

      if (activeTab === 'chart') {
        refetchChart()
      } else if (activeTab === 'monthly') {
        refetchMonthly()
      }
    } catch {
      toast.error('统计失败，请重试')
    }
  }, [activeTab, chartDateRange, weeklyViewWeekStart, weeksData, computeMutation, refetchChart, refetchMonthly])

  // 是否可以前进
  const canChartGoForward = dayjs(endDate).isBefore(dayjs(), 'day')
  const canWeeklyGoForward = dayjs(weeklyViewWeekStart).isBefore(dayjs().weekday(0), 'day')
  const canMonthlyGoForward = dayjs(monthlyViewWeekStart).isBefore(dayjs().weekday(0), 'day')

  const isLoading = activeTab === 'chart' ? chartLoading : monthlyLoading

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#fefbf6] to-[#fff5e6] dark:from-[#1a1a2e] dark:to-[#16213e] safe-area-top safe-area-bottom">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-100 dark:border-gray-800">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BackHomeButton babyId={babyId} />
            <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
              <TrendingUp size={22} />
              查看趋势
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={computeMutation.isPending}
              className="px-4 py-2 rounded-full bg-primary/10 text-primary font-medium text-base flex items-center gap-1 disabled:opacity-50"
            >
              <RefreshCw size={18} className={computeMutation.isPending ? 'animate-spin' : ''} />
            </button>
            <AppDrawerMenu babyId={babyId} />
          </div>
        </div>

        {/* Tab 切换 */}
        <div className="px-4 pb-3 flex justify-center gap-2">
          <button
            onClick={() => setActiveTab('chart')}
            className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-1.5 transition-colors ${activeTab === 'chart'
              ? 'bg-primary text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}
          >
            <BarChart3 size={16} />
            折线图
          </button>
          <button
            onClick={() => setActiveTab('weekly')}
            className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-1.5 transition-colors ${activeTab === 'weekly'
              ? 'bg-primary text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}
          >
            <Calendar size={16} />
            周历
          </button>
          <button
            onClick={() => setActiveTab('monthly')}
            className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-1.5 transition-colors ${activeTab === 'monthly'
              ? 'bg-primary text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}
          >
            <CalendarDays size={16} />
            月历
          </button>
        </div>

        {/* 图表视图的日期导航 */}
        {activeTab === 'chart' && (
          <div className="px-4 pb-3 flex items-center justify-between">
            <button
              onClick={() => navigateChartDays(-1)}
              className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
            >
              <ChevronLeft size={24} />
            </button>
            <p className="text-lg font-bold text-gray-800 dark:text-gray-100">
              {formatDateChinese(chartStartDate)} - {formatDateChinese(endDate)}
            </p>
            <button
              onClick={() => navigateChartDays(1)}
              disabled={!canChartGoForward}
              className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-50"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        )}
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500">加载中...</p>
        </div>
      ) : (
        <div className="p-4">
          {activeTab === 'chart' && (
            <ChartView
              chartData={chartData}
              daysToShow={daysToShow}
              setDaysToShow={setDaysToShow}
            />
          )}
          {activeTab === 'weekly' && (
            <WeeklyView
              weekStart={weeklyViewWeekStart}
              onNavigate={navigateWeeklyWeek}
              canGoForward={canWeeklyGoForward}
            />
          )}
          {activeTab === 'monthly' && (
            <MonthlyView
              weeksData={weeksData}
              maxValues={monthlyMaxValues}
              onNavigate={navigateMonthlyWeek}
              canGoForward={canMonthlyGoForward}
              weeksToShow={weeksToShow}
              activitiesPath={activitiesPath}
            />
          )}
        </div>
      )}
    </main>
  )
}

export default function DailyStatsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <TrendingUp size={32} className="mx-auto text-gray-400 mb-2 animate-pulse" />
          <p className="text-gray-500">加载中...</p>
        </div>
      </div>
    }>
      <DailyStatsPageContent />
    </Suspense>
  )
}
