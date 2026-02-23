'use client'

import { useCallback, useMemo, useEffect, useRef, Suspense, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { BabySwitcher, type BabySwitcherItem } from '@/components/BabySwitcher'
import { AppDrawerMenu } from '@/components/AppDrawerMenu'
import { PullToRefresh } from '@/components/PullToRefresh'
import { ActivityFAB } from '@/components/ActivityFAB'
import { DayTimeline, type DayTimelineRef } from '@/components/DayTimeline'
import { UpdatePrompt } from '@/components/UpdatePrompt'
import { useVersionCheck } from '@/hooks/useVersionCheck'
import { useModalParams, activityTypeToModalType } from '@/hooks/useModalParams'
import { calculateDurationMinutes, calculateDurationInDay, formatDateChinese, formatWeekday, formatTime, dayjs } from '@/lib/dayjs'
import { Loader2 } from 'lucide-react'
import { useActivities, type Activity } from '@/lib/api/hooks'
import { PreviousEveningSummary } from '@/components/PreviousEveningSummary'
import { StatsCardList, type DaySummary, type StatFilter } from '@/components/StatsCardList'
import { ActivityPicker } from '@/components/ActivityPicker'
import { ActivityType } from '@/types/activity'
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation'
import { DateNavigator } from '@bubu-log/log-ui'
import { buildBabyScopedPath, withCurrentBabyIdOnApiPath } from '@/lib/baby-scope'

const STAT_FILTERS: StatFilter[] = ['sleep', 'bottle', 'breastfeed', 'pump', 'diaper', 'outdoor', 'headLift', 'rollOver']

const statFilterActivityTypes: Record<StatFilter, ActivityType[]> = {
  sleep: [ActivityType.SLEEP],
  bottle: [ActivityType.BOTTLE],
  breastfeed: [ActivityType.BREASTFEED],
  pump: [ActivityType.PUMP],
  diaper: [ActivityType.DIAPER],
  outdoor: [ActivityType.OUTDOOR],
  headLift: [ActivityType.HEAD_LIFT],
  rollOver: [ActivityType.ROLL_OVER],
}

const legacyFilterMapping: Partial<Record<string, StatFilter[]>> = {
  sleep: ['sleep'],
  feeding: ['bottle', 'breastfeed'],
  diaper: ['diaper'],
  activities: ['outdoor', 'headLift', 'rollOver'],
}

const DEFAULT_DURATIONS: Partial<Record<ActivityType | 'wake', number>> = {
  [ActivityType.HEAD_LIFT]: 5,
  [ActivityType.PASSIVE_EXERCISE]: 10,
  [ActivityType.GAS_EXERCISE]: 10,
  [ActivityType.BATH]: 15,
  [ActivityType.OUTDOOR]: 30,
  [ActivityType.EARLY_EDUCATION]: 20,
  [ActivityType.BOTTLE]: 15,
  [ActivityType.BREASTFEED]: 15,
  wake: 60, // 睡醒默认 1 小时
}

function isStatFilter(value: string): value is StatFilter {
  return STAT_FILTERS.includes(value as StatFilter)
}

type AuthContextPayload = {
  authenticated: boolean
  hasBaby: boolean
  code?: string
  defaultBabyId?: string | null
  baby: BabySwitcherItem | null
  babies: BabySwitcherItem[]
}

function NoBabyPrompt() {
  return (
    <main className="min-h-screen px-4 py-8 flex items-center">
      <section className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm space-y-3">
        <h1 className="text-xl font-semibold text-amber-900">当前账号还没有绑定宝宝</h1>
        <p className="text-sm text-amber-800">
          该账号暂时无法使用记录功能。请先让管理员在后台创建并绑定宝宝信息（姓名、照片、出生日期、性别）。
        </p>
      </section>
    </main>
  )
}

function HomeContent({ authContext }: { authContext: AuthContextPayload }) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()
  const routeParams = useParams<{ babyId: string }>()
  const searchParams = useSearchParams()
  const timelineRef = useRef<DayTimelineRef>(null)
  const currentBabyId = routeParams?.babyId || authContext.baby?.id || ''
  
  const activeFilters = useMemo<StatFilter[]>(() => {
    const filtersParam = searchParams.get('filters')
    if (filtersParam) {
      return Array.from(new Set(filtersParam.split(',').map(filter => filter.trim()).filter(isStatFilter)))
    }

    const legacyFilter = searchParams.get('filter')
    if (legacyFilter && legacyFilterMapping[legacyFilter]) {
      return legacyFilterMapping[legacyFilter] || []
    }

    return []
  }, [searchParams])
  
  // 活动选择器状态
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerDefaultTime, setPickerDefaultTime] = useState<Date | null>(null)
  
  // URL 参数管理（包括日期）
  const { openActivityDetail, openModal, selectedDate, selectedDateStr, setSelectedDate } = useModalParams()

  // 获取当天活动数据（包括跨夜活动）
  const { data: todayActivities = [], isLoading: activitiesLoading } = useActivities({
    date: selectedDateStr,
    limit: 200,
  })
  
  // 计算前一天晚上的时间范围（用于"昨晚摘要"）
  const previousEveningRange = useMemo(() => {
    const currentDayStart = dayjs(selectedDate).startOf('day')
    const previousDay = currentDayStart.subtract(1, 'day')
    const eveningStart = previousDay.hour(18).minute(0).second(0)
    return {
      startTimeGte: eveningStart.toISOString(),
      startTimeLt: currentDayStart.toISOString(),
    }
  }, [selectedDate])
  
  // 单独请求前一天晚上的活动（用于"昨晚摘要"）
  const { data: previousDayActivities = [] } = useActivities({
    ...previousEveningRange,
    limit: 50,
  })
  
  // 版本检测 - 每分钟检查一次新版本
  const { hasNewVersion, refresh: refreshPage, dismiss: dismissUpdate } = useVersionCheck(60000)

  // 计算每日统计
  // 注意：只有睡眠可以跨天计算，其他活动（奶量、尿布）需要严格按当天时间过滤
  const summary = useMemo<DaySummary>(() => {
    const result: DaySummary = {
      sleepCount: 0,
      totalSleepMinutes: 0,
      totalBottleMilkAmount: 0,
      totalBreastfeedMinutes: 0,
      totalPumpMilkAmount: 0,
      diaperCount: 0,
      largePeeDiaperCount: 0,
      smallMediumPeeDiaperCount: 0,
      totalOutdoorMinutes: 0,
      totalHeadLiftMinutes: 0,
      totalRollOverCount: 0,
      totalPullToSitCount: 0,
    }

    const currentDayStart = dayjs(selectedDate).startOf('day')
    const currentDayEnd = dayjs(selectedDate).endOf('day')

    // 使用 todayActivities 进行统计
    for (const activity of todayActivities) {
      const activityStartTime = dayjs(activity.startTime)
      const isActivityInToday = !activityStartTime.isBefore(currentDayStart) && !activityStartTime.isAfter(currentDayEnd)

      switch (activity.type) {
        case 'SLEEP':
          // 睡眠可以跨天计算，但只计算当天范围内的部分（0点到24点）
          if (activity.endTime) {
            const sleepMinutesInDay = calculateDurationInDay(activity.startTime, activity.endTime, selectedDate)
            if (sleepMinutesInDay > 0) {
              result.sleepCount++
              result.totalSleepMinutes += sleepMinutesInDay
            }
          }
          break
        case 'BREASTFEED':
          // 亲喂：只统计当天发生的（startTime在当天）
          if (isActivityInToday) {
            // 计算亲喂时长（只计算当天的部分）
            if (activity.endTime) {
              const endTime = dayjs(activity.endTime)
              const actualEndTime = endTime.isAfter(currentDayEnd) ? currentDayEnd.toDate() : activity.endTime
              result.totalBreastfeedMinutes += calculateDurationMinutes(activity.startTime, actualEndTime)
            }
          }
          break
        case 'BOTTLE':
          // 瓶喂：只统计当天发生的（startTime在当天）
          if (isActivityInToday && activity.milkAmount) {
            result.totalBottleMilkAmount += activity.milkAmount
          }
          break
        case 'PUMP':
          // 吸奶：只统计当天发生的（startTime在当天）
          if (isActivityInToday && activity.milkAmount) {
            result.totalPumpMilkAmount += activity.milkAmount
          }
          break
        case 'DIAPER':
          // 尿布：只统计当天发生的（startTime在当天）
          if (isActivityInToday) {
            result.diaperCount++
            // 统计尿量
            if (activity.hasPee) {
              if (activity.peeAmount === 'LARGE') {
                result.largePeeDiaperCount++
              } else if (activity.peeAmount === 'MEDIUM' || activity.peeAmount === 'SMALL') {
                result.smallMediumPeeDiaperCount++
              }
            }
          }
          break
        case 'HEAD_LIFT':
          // 抬头：只统计当天发生的（startTime在当天）
          if (isActivityInToday && activity.endTime) {
            const endTime = dayjs(activity.endTime)
            const actualEndTime = endTime.isAfter(currentDayEnd) ? currentDayEnd.toDate() : activity.endTime
            result.totalHeadLiftMinutes += calculateDurationMinutes(activity.startTime, actualEndTime)
          }
          break
        case 'OUTDOOR':
          // 户外：只统计当天发生的（startTime在当天）
          if (isActivityInToday && activity.endTime) {
            const endTime = dayjs(activity.endTime)
            const actualEndTime = endTime.isAfter(currentDayEnd) ? currentDayEnd.toDate() : activity.endTime
            result.totalOutdoorMinutes += calculateDurationMinutes(activity.startTime, actualEndTime)
          }
          break
        case 'ROLL_OVER':
          // 翻身：只统计当天发生的（startTime在当天）
          if (isActivityInToday) {
            result.totalRollOverCount += activity.count || 1
          }
          break
        case 'PULL_TO_SIT':
          // 拉坐：只统计当天发生的（startTime在当天）
          if (isActivityInToday) {
            result.totalPullToSitCount += activity.count || 1
          }
          break
      }
    }

    return result
  }, [todayActivities, selectedDate])

  // 日期导航
  const navigateDate = useCallback((days: number) => {
    const newDate = dayjs(selectedDate).add(days, 'day').toDate()
    setSelectedDate(newDate)
  }, [selectedDate, setSelectedDate])

  // 是否是今天
  const isToday = selectedDateStr === dayjs().format('YYYY-MM-DD')

  // 自动滚动到当前时间
  useEffect(() => {
    if (!isToday || activitiesLoading) return
    
    const LAST_VISIT_KEY = 'bubu-log-last-visit'
    const now = Date.now()
    const lastVisit = localStorage.getItem(LAST_VISIT_KEY)
    const thirtyMinutes = 30 * 60 * 1000
    
    // 首次访问或超过30分钟，滚动到当前时间
    if (!lastVisit || now - parseInt(lastVisit) > thirtyMinutes) {
      setTimeout(() => {
        timelineRef.current?.scrollToCurrentTime()
      }, 100)
    }
    
    // 更新最后访问时间
    localStorage.setItem(LAST_VISIT_KEY, now.toString())
    
    // 页面可见性变化时检测
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const lastTime = localStorage.getItem(LAST_VISIT_KEY)
        if (lastTime && Date.now() - parseInt(lastTime) > thirtyMinutes) {
          timelineRef.current?.scrollToCurrentTime()
        }
        localStorage.setItem(LAST_VISIT_KEY, Date.now().toString())
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [isToday, activitiesLoading])

  // 下拉刷新处理
  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries()
    toast.success('刷新成功')
  }, [queryClient])

  // 点击活动查看详情 - 通过 URL 打开弹窗
  const handleActivityClick = useCallback((activity: Activity) => {
    openActivityDetail(activity.id)
  }, [openActivityDetail])

  // 点击统计卡片 - 多选过滤主页活动
  const handleStatCardClick = useCallback((filter: StatFilter) => {
    const params = new URLSearchParams(searchParams.toString())
    const nextFilters = new Set(activeFilters)
    if (nextFilters.has(filter)) {
      nextFilters.delete(filter)
    } else {
      nextFilters.add(filter)
    }

    if (nextFilters.size === 0) {
      params.delete('filters')
      params.delete('filter')
    } else {
      params.set('filters', Array.from(nextFilters).join(','))
      params.delete('filter')
    }
    
    const queryString = params.toString()
    router.push(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false })
  }, [activeFilters, pathname, router, searchParams])

  // 过滤后的活动列表
  const filteredActivities = useMemo(() => {
    if (activeFilters.length === 0) return todayActivities

    const allowedTypes = new Set(
      activeFilters.flatMap(filter => statFilterActivityTypes[filter])
    )
    return todayActivities.filter(activity => allowedTypes.has(activity.type as ActivityType))
  }, [todayActivities, activeFilters])

  // 长按时间轴空白处 - 打开活动选择器
  const handleTimelineLongPress = useCallback((time: Date) => {
    setPickerDefaultTime(time)
    setPickerOpen(true)
  }, [])

  // 活动选择器选择活动
  const handlePickerSelect = useCallback((type: ActivityType | 'wake') => {
    const modalType = activityTypeToModalType[type]
    if (pickerDefaultTime) {
      const defaultDuration = DEFAULT_DURATIONS[type]
      const params: Record<string, string> = {
        startTime: pickerDefaultTime.toISOString(),
      }
      // 对于有时长的活动，设置结束时间
      // 排除尿布（点事件）和入睡（只有开始时间）
      if (defaultDuration && type !== ActivityType.DIAPER && type !== ActivityType.SLEEP) {
        const endTime = dayjs(pickerDefaultTime).add(defaultDuration, 'minute').toDate()
        params.endTime = endTime.toISOString()
      }
      openModal(modalType, { params })
    } else {
      openModal(modalType)
    }
    setPickerOpen(false)
  }, [openModal, pickerDefaultTime])

  // 活动选择器选择尿布
  const handlePickerDiaperSelect = useCallback((diaperType: 'poop' | 'pee' | 'both') => {
    const params: Record<string, string> = {
      hasPoop: (diaperType === 'poop' || diaperType === 'both').toString(),
      hasPee: (diaperType === 'pee' || diaperType === 'both').toString(),
    }
    if (pickerDefaultTime) {
      params.startTime = pickerDefaultTime.toISOString()
    }
    openModal('diaper', { params })
    setPickerOpen(false)
  }, [openModal, pickerDefaultTime])

  // 活动选择器选择补剂
  const handlePickerSupplementSelect = useCallback((supplementType: 'AD' | 'D3') => {
    const params: Record<string, string> = {
      supplementType,
    }
    if (pickerDefaultTime) {
      params.startTime = pickerDefaultTime.toISOString()
    }
    openModal('supplement', { params })
    setPickerOpen(false)
  }, [openModal, pickerDefaultTime])

  return (
    <>
    <PullToRefresh onRefresh={handleRefresh}>
      <main className="pb-24">
        {/* 头部 */}
        <header className="px-4 py-3 flex items-center gap-3">
          {/* 头像宝宝切换器 */}
          <BabySwitcher
            babies={authContext.babies}
            currentBabyId={currentBabyId}
          />
          
          {/* 日期切换器 */}
          <DateNavigator
            label={isToday ? '今天' : formatDateChinese(selectedDate)}
            subLabel={formatWeekday(selectedDate)}
            onPrev={() => navigateDate(-1)}
            onNext={() => navigateDate(1)}
            disableNext={isToday}
            variant="inline"
            className="flex-1"
            prevTestId="date-prev-btn"
            nextTestId="date-next-btn"
          />
          
          {/* 右侧：抽屉菜单入口 */}
          <AppDrawerMenu babyId={currentBabyId} />
        </header>

        {/* 今日统计卡片 - 点击过滤主页活动 */}
        <div className="px-4 py-3">
          <StatsCardList 
            summary={summary} 
            activeFilters={activeFilters}
            onStatCardClick={handleStatCardClick}
          />
        </div>

        {/* 时间线 */}
        <div className="px-4">
          {activitiesLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={32} className="animate-spin text-gray-400" />
            </div>
          ) : todayActivities.length === 0 && previousDayActivities.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-lg mb-2">还没有记录</p>
              <p className="text-sm">点击右下角的 + 按钮添加活动</p>
            </div>
          ) : (
            <>
              {/* 前一天晚上的摘要 */}
              <PreviousEveningSummary
                activities={previousDayActivities}
                date={selectedDate}
                onActivityClick={handleActivityClick}
              />
              
              {/* 当天时间线 */}
              <DayTimeline
                ref={timelineRef}
                activities={filteredActivities}
                date={selectedDate}
                onActivityClick={handleActivityClick}
                showCurrentTime={isToday}
                onLongPressBlank={handleTimelineLongPress}
              />
            </>
          )}
        </div>

        {/* 新版本提示 */}
        {hasNewVersion && (
          <UpdatePrompt onRefresh={refreshPage} onDismiss={dismissUpdate} />
        )}
      </main>
    </PullToRefresh>

    {/* 悬浮操作按钮 - 放在 PullToRefresh 外面，避免 transform 影响 fixed 定位 */}
    <ActivityFAB
      onVoiceSuccess={(message) => toast.success(message)}
      onVoiceError={(message) => toast.error(message)}
      targetDate={selectedDate}
    />

    {/* 活动选择器 - 长按时间轴触发 */}
    <ActivityPicker
      isOpen={pickerOpen}
      onClose={() => setPickerOpen(false)}
      onSelect={handlePickerSelect}
      onDiaperSelect={handlePickerDiaperSelect}
      onSupplementSelect={handlePickerSupplementSelect}
      selectedTime={pickerDefaultTime ? formatTime(pickerDefaultTime) : undefined}
    />
    </>
  )
}

function HomeGate() {
  const [state, setState] = useState<'loading' | 'ready' | 'no_baby'>('loading')
  const [authContext, setAuthContext] = useState<AuthContextPayload | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadAuthContext() {
      try {
        const response = await fetch(withCurrentBabyIdOnApiPath('/api/app/auth/context'), { cache: 'no-store' })
        const payload = (await response.json().catch(() => null)) as AuthContextPayload | null

        if (response.status === 401) {
          window.location.href = '/login'
          return
        }

        if (response.status === 403 && payload?.code === 'BABY_FORBIDDEN' && payload.baby?.id) {
          window.location.href = buildBabyScopedPath(payload.baby.id)
          return
        }

        if (!response.ok) {
          if (!cancelled) {
            setState('ready')
          }
          return
        }

        if (!cancelled && payload) {
          setAuthContext(payload)
          setState(payload.hasBaby ? 'ready' : 'no_baby')
        }
      } catch (error) {
        console.error('Failed to load auth context:', error)
        if (!cancelled) {
          setState('ready')
        }
      }
    }

    loadAuthContext()

    return () => {
      cancelled = true
    }
  }, [])

  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={32} className="animate-spin text-gray-400" />
      </div>
    )
  }

  if (state === 'no_baby') {
    return <NoBabyPrompt />
  }

  return authContext ? <HomeContent authContext={authContext} /> : <NoBabyPrompt />
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={32} className="animate-spin text-gray-400" />
      </div>
    }>
      <HomeGate />
    </Suspense>
  )
}
