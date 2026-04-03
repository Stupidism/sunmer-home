'use client'

import { useMemo, useRef, useImperativeHandle, forwardRef, useEffect, useState, useCallback } from 'react'
import { ActivityType, ActivityTypeLabels } from '@/types/activity'
import { ActivityIcon } from './ActivityIcon'
import type { Activity } from '@/lib/api/hooks'
import { dayjs, calculateDurationMinutes, formatTime, formatDuration } from '@/lib/dayjs'
import { TimelineGrid } from '@bubu-log/log-ui'

interface DayTimelineProps {
  activities: Activity[]
  date: Date
  onActivityClick?: (activity: Activity) => void
  showCurrentTime?: boolean
  /** 长按空白处时触发，传入选中的时间 */
  onLongPressBlank?: (time: Date) => void
}

export interface DayTimelineRef {
  scrollToCurrentTime: () => void
}

// 进食类活动（左侧）- 粉红/红色系
const FEEDING_TYPES = new Set<string>([
  'BOTTLE', 'BREASTFEED', 'PUMP', 'SPIT_UP', 'SUPPLEMENT',
])

// 运动类活动（右侧）- 蓝/绿色系
const EXERCISE_TYPES = new Set<string>([
  'OUTDOOR', 'ROLL_OVER', 'PULL_TO_SIT', 'HEAD_LIFT',
  'PASSIVE_EXERCISE', 'GAS_EXERCISE', 'BATH', 'EARLY_EDUCATION',
])

// 活动类型对应的颜色 - 进食类使用粉红/红色系，运动类使用蓝/绿色系
const activityColors: Record<string, { bg: string; border: string; text: string; divider?: string }> = {
  // 进食类 - 粉红/红色系
  BREASTFEED: { bg: 'bg-rose-100 dark:bg-rose-900/40', border: 'border-rose-400', text: 'text-rose-700 dark:text-rose-300' },
  BOTTLE: { bg: 'bg-pink-100 dark:bg-pink-900/40', border: 'border-pink-400', text: 'text-pink-700 dark:text-pink-300' },
  PUMP: { bg: 'bg-fuchsia-100 dark:bg-fuchsia-900/40', border: 'border-fuchsia-400', text: 'text-fuchsia-700 dark:text-fuchsia-300' },
  SUPPLEMENT: { bg: 'bg-red-50 dark:bg-red-900/40', border: 'border-red-300', text: 'text-red-700 dark:text-red-300', divider: 'bg-red-400' },
  SPIT_UP: { bg: 'bg-red-100 dark:bg-red-900/40', border: 'border-red-400', text: 'text-red-700 dark:text-red-300', divider: 'bg-red-400' },
  // 运动类 - 蓝/绿色系
  HEAD_LIFT: { bg: 'bg-blue-100 dark:bg-blue-900/40', border: 'border-blue-400', text: 'text-blue-700 dark:text-blue-300' },
  PASSIVE_EXERCISE: { bg: 'bg-teal-100 dark:bg-teal-900/40', border: 'border-teal-400', text: 'text-teal-700 dark:text-teal-300' },
  GAS_EXERCISE: { bg: 'bg-cyan-100 dark:bg-cyan-900/40', border: 'border-cyan-400', text: 'text-cyan-700 dark:text-cyan-300' },
  BATH: { bg: 'bg-sky-100 dark:bg-sky-900/40', border: 'border-sky-400', text: 'text-sky-700 dark:text-sky-300' },
  OUTDOOR: { bg: 'bg-emerald-100 dark:bg-emerald-900/40', border: 'border-emerald-500', text: 'text-emerald-700 dark:text-emerald-300' },
  EARLY_EDUCATION: { bg: 'bg-indigo-100 dark:bg-indigo-900/40', border: 'border-indigo-400', text: 'text-indigo-700 dark:text-indigo-300' },
  ROLL_OVER: { bg: 'bg-blue-100 dark:bg-blue-900/40', border: 'border-blue-400', text: 'text-blue-700 dark:text-blue-300' },
  PULL_TO_SIT: { bg: 'bg-teal-100 dark:bg-teal-900/40', border: 'border-teal-400', text: 'text-teal-700 dark:text-teal-300' },
  // 其他
  DIAPER: { bg: 'bg-yellow-100 dark:bg-yellow-900/40', border: 'border-yellow-400', text: 'text-yellow-800 dark:text-yellow-300', divider: 'bg-yellow-500' },
}

const defaultColor = { bg: 'bg-gray-100 dark:bg-gray-800', border: 'border-gray-400', text: 'text-gray-700 dark:text-gray-300' }

// 每小时的默认高度（像素）
const DEFAULT_HOUR_HEIGHT = 60
const MIN_HOUR_HEIGHT = 30
const MAX_HOUR_HEIGHT = 200
// 有时长活动的最小高度（确保能显示内容）
const MIN_DURATION_BLOCK_HEIGHT = 15

export const DayTimeline = forwardRef<DayTimelineRef, DayTimelineProps>(
  function DayTimeline({ activities, date, onActivityClick, showCurrentTime = false, onLongPressBlank }, ref) {
    const currentTimeRef = useRef<HTMLDivElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [currentMinutes, setCurrentMinutes] = useState(() => {
      const now = new Date()
      return now.getHours() * 60 + now.getMinutes()
    })

    // 双指缩放状态
    const [hourHeight, setHourHeight] = useState(DEFAULT_HOUR_HEIGHT)
    const pinchRef = useRef<{ initialDistance: number; initialHourHeight: number } | null>(null)

    // 更新当前时间（每分钟）
    useEffect(() => {
      if (!showCurrentTime) return

      const updateTime = () => {
        const now = new Date()
        setCurrentMinutes(now.getHours() * 60 + now.getMinutes())
      }

      const interval = setInterval(updateTime, 60000)
      return () => clearInterval(interval)
    }, [showCurrentTime])

    // 双指缩放处理
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const distance = Math.sqrt(dx * dx + dy * dy)
        pinchRef.current = { initialDistance: distance, initialHourHeight: hourHeight }
      }
    }, [hourHeight])

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault()
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const distance = Math.sqrt(dx * dx + dy * dy)
        const scale = distance / pinchRef.current.initialDistance
        const newHeight = Math.min(MAX_HOUR_HEIGHT, Math.max(MIN_HOUR_HEIGHT, pinchRef.current.initialHourHeight * scale))
        setHourHeight(Math.round(newHeight))
      }
    }, [])

    const handleTouchEnd = useCallback(() => {
      pinchRef.current = null
    }, [])

    // 暴露滚动方法
    useImperativeHandle(ref, () => ({
      scrollToCurrentTime: () => {
        if (currentTimeRef.current) {
          currentTimeRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          })
        }
      }
    }))

    // 分离睡眠活动和其他活动
    const { sleepActivities, nonSleepActivities } = useMemo(() => {
      const sleep: Activity[] = []
      const nonSleep: Activity[] = []
      for (const a of activities) {
        if (a.type === 'SLEEP') {
          sleep.push(a)
        } else {
          nonSleep.push(a)
        }
      }
      return { sleepActivities: sleep, nonSleepActivities: nonSleep }
    }, [activities])

    // 计算睡眠背景区域
    const sleepBackgrounds = useMemo(() => {
      const dayStart = dayjs(date).startOf('day')
      const dayEnd = dayStart.add(1, 'day')

      return sleepActivities.map(activity => {
        const startTime = dayjs(activity.startTime)
        const endTime = activity.endTime ? dayjs(activity.endTime) : startTime.add(5, 'minute')

        const visualStart = startTime.isBefore(dayStart) ? dayStart : startTime
        const visualEnd = endTime.isAfter(dayEnd) ? dayEnd : endTime

        const topMinutes = visualStart.diff(dayStart, 'minute')
        const top = (topMinutes / 60) * hourHeight
        const durationMinutes = visualEnd.diff(visualStart, 'minute')
        const height = Math.max((durationMinutes / 60) * hourHeight, 4)

        // 计算实际睡眠时长（不裁剪到当天）
        const totalDuration = endTime.diff(startTime, 'minute')
        const hours = Math.floor(totalDuration / 60)
        const mins = totalDuration % 60
        const durationLabel = hours > 0
          ? (mins > 0 ? `${hours}h${mins}m` : `${hours}h`)
          : `${mins}m`

        return {
          id: activity.id,
          top,
          height,
          startTimeLabel: formatTime(startTime.toDate()),
          endTimeLabel: formatTime(endTime.toDate()),
          durationLabel,
          activity,
        }
      })
    }, [sleepActivities, date, hourHeight])

    // 计算非睡眠活动在时间线上的位置
    const positionedActivities = useMemo(() => {
      const dayStart = dayjs(date).startOf('day')
      const dayEnd = dayStart.add(1, 'day')

      return nonSleepActivities.map(activity => {
        const startTime = dayjs(activity.startTime)

        // 换尿布、补剂、吐奶是瞬时事件，显示为线条
        const isLineType = activity.type === 'DIAPER' || activity.type === 'SUPPLEMENT' || activity.type === 'SPIT_UP'

        // 计算时长：有 endTime 则计算差值，否则默认 5 分钟（非线条类型）
        const duration = activity.endTime
          ? calculateDurationMinutes(activity.startTime, activity.endTime)
          : (isLineType ? 0 : 5)

        // 跨天活动在时间线里要裁剪到当天
        const visualStart = startTime.isBefore(dayStart) ? dayStart : startTime
        const rawEndTime = activity.endTime ? dayjs(activity.endTime) : startTime.add(Math.max(duration, 1), 'minute')
        const visualEnd = rawEndTime.isAfter(dayEnd) ? dayEnd : rawEndTime
        const visualMinutesFromStart = visualStart.diff(dayStart, 'minute')
        const top = (visualMinutesFromStart / 60) * hourHeight
        const visualDurationMinutes = Math.max(visualEnd.diff(visualStart, 'minute'), isLineType ? 0 : 1)

        // 线条类型固定高度为 2px，其他按时长计算（有最小高度确保可点击）
        const height = isLineType
          ? 2
          : Math.max((visualDurationMinutes / 60) * hourHeight, MIN_DURATION_BLOCK_HEIGHT)

        return {
          ...activity,
          top,
          height,
          startTimeDate: startTime.toDate(),
          endTimeDate: activity.endTime ? dayjs(activity.endTime).toDate() : startTime.toDate(),
          duration,
          isLineType,
        }
      }).sort((a, b) => a.top - b.top)
    }, [nonSleepActivities, date, hourHeight])

    // 根据分组规则布局活动
    const layoutActivities = useMemo(() => {
      const result: Array<typeof positionedActivities[0] & { left: number; width: number }> = []

      for (const activity of positionedActivities) {
        // 线条类型（瞬时事件）始终全宽
        if (activity.isLineType) {
          result.push({ ...activity, left: 0, width: 100 })
          continue
        }

        const type = activity.type as string

        if (FEEDING_TYPES.has(type)) {
          // 进食类 - 左侧，占 2/3 宽度
          result.push({ ...activity, left: 0, width: 64 })
        } else if (EXERCISE_TYPES.has(type)) {
          // 运动类 - 右侧，占 2/3 宽度
          result.push({ ...activity, left: 36, width: 64 })
        } else if (type === 'DIAPER') {
          // 换尿布 - 居中
          result.push({ ...activity, left: 17, width: 66 })
        } else {
          // 其他未分类 - 全宽
          result.push({ ...activity, left: 0, width: 100 })
        }
      }

      return result
    }, [positionedActivities])

    // 计算每个喂奶活动距上次同类活动的间隔（不再计算睡眠间隔，因为睡眠已是背景）
    const gapSinceLastMap = useMemo(() => {
      const map = new Map<string, number>()

      // 按开始时间排序的喂奶活动（亲喂+瓶喂）
      const feedActivities = activities
        .filter(a => a.type === 'BREASTFEED' || a.type === 'BOTTLE')
        .sort((a, b) => dayjs(a.startTime).valueOf() - dayjs(b.startTime).valueOf())
      for (let i = 1; i < feedActivities.length; i++) {
        const prev = feedActivities[i - 1]
        const curr = feedActivities[i]
        const prevEnd = prev.endTime || prev.startTime
        const gap = dayjs(curr.startTime).diff(dayjs(prevEnd), 'minute')
        if (gap > 0) map.set(curr.id, gap)
      }

      return map
    }, [activities])

    // 计算距离上次睡觉/吃奶的时间（用于当前时间标记）
    const timeSinceLastSleepAndFeed = useMemo(() => {
      if (!showCurrentTime) return null
      const now = dayjs()
      let lastSleepEnd: ReturnType<typeof dayjs> | null = null
      let lastFeedEnd: ReturnType<typeof dayjs> | null = null

      for (const a of activities) {
        const end = a.endTime ? dayjs(a.endTime) : dayjs(a.startTime)
        if (end.isAfter(now)) continue
        if (a.type === 'SLEEP') {
          if (!lastSleepEnd || end.isAfter(lastSleepEnd)) lastSleepEnd = end
        }
        if (a.type === 'BREASTFEED' || a.type === 'BOTTLE') {
          if (!lastFeedEnd || end.isAfter(lastFeedEnd)) lastFeedEnd = end
        }
      }

      return {
        sleep: lastSleepEnd ? now.diff(lastSleepEnd, 'minute') : null,
        feed: lastFeedEnd ? now.diff(lastFeedEnd, 'minute') : null,
      }
    }, [activities, showCurrentTime, currentMinutes]) // eslint-disable-line react-hooks/exhaustive-deps

    const getActivityLabel = (activity: typeof positionedActivities[0]) => {
      const type = activity.type as ActivityType
      let label = ActivityTypeLabels[type] || activity.type

      if ((activity.type === 'BOTTLE' || activity.type === 'PUMP') && activity.milkAmount) {
        label += ` ${activity.milkAmount}ml`
      } else if (activity.type === 'DIAPER') {
        if (activity.hasPoop && activity.hasPee) {
          label = '大小便'
        } else if (activity.hasPoop) {
          label = '大便'
        } else if (activity.hasPee) {
          label = '小便'
        }
      } else if (activity.type === 'SUPPLEMENT') {
        if (activity.supplementType) {
          label = activity.supplementType
        }
      } else if (activity.type === 'SPIT_UP') {
        if (activity.spitUpType === 'PROJECTILE') {
          label = '喷射性吐奶'
        } else {
          label = '普通吐奶'
        }
      } else if (activity.duration && activity.duration > 0) {
        label += ` ${activity.duration}分钟`
      }

      return label
    }

    // 当前时间位置
    const currentTimeTop = (currentMinutes / 60) * hourHeight

    return (
      <div
        ref={containerRef}
        className="relative bg-white dark:bg-gray-800 rounded-2xl overflow-hidden touch-manipulation"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <TimelineGrid
          date={date}
          hourHeight={hourHeight}
          showHalfHours
          onLongPressBlank={onLongPressBlank}
          className="relative"
        >
          {/* 睡眠背景层 - 最低层级 */}
          <div className="absolute left-0 right-0 top-0 bottom-0 z-0 pointer-events-none">
            {sleepBackgrounds.map(sleep => (
              <div
                key={sleep.id}
                className="absolute left-0 right-0"
                style={{ top: sleep.top, height: sleep.height }}
              >
                {/* 淡紫色背景 */}
                <div className="absolute inset-0 bg-violet-100/60 dark:bg-violet-900/30" />
                {/* 顶部分界线 + 开始时间 */}
                <div className="absolute top-0 left-0 right-0 h-px bg-violet-300 dark:bg-violet-600" />
                {/* 底部分界线 */}
                <div className="absolute bottom-0 left-0 right-0 h-px bg-violet-300 dark:bg-violet-600" />
                {/* 睡眠信息标签 - 贴近左侧边界 */}
                <div className="absolute left-2 top-1 flex items-center gap-1">
                  <span className="text-[10px] text-violet-500 dark:text-violet-400 font-medium whitespace-nowrap">
                    🌙 {sleep.startTimeLabel}开始 {sleep.durationLabel}
                  </span>
                </div>
                {/* 结束时间标签 - 贴近底部边界 */}
                {sleep.height > 30 && (
                  <div className="absolute left-2 bottom-1">
                    <span className="text-[10px] text-violet-400 dark:text-violet-500 whitespace-nowrap">
                      {sleep.endTimeLabel}醒来
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 当前时间指示器 */}
          {showCurrentTime && (
            <div
              ref={currentTimeRef}
              className="absolute left-0 right-0 z-20 pointer-events-none"
              style={{ top: currentTimeTop }}
            >
              {/* 距上次睡觉/吃奶的时间 - 红线上方 */}
              {timeSinceLastSleepAndFeed && (
                <div className="absolute left-14 right-2 flex gap-3 -top-5">
                  {timeSinceLastSleepAndFeed.sleep != null && (
                    <span className="text-[10px] text-violet-500 whitespace-nowrap">
                      距上次睡觉 {formatDuration(timeSinceLastSleepAndFeed.sleep)}
                    </span>
                  )}
                  {timeSinceLastSleepAndFeed.feed != null && (
                    <span className="text-[10px] text-pink-500 whitespace-nowrap">
                      距上次吃奶 {formatDuration(timeSinceLastSleepAndFeed.feed)}
                    </span>
                  )}
                </div>
              )}
              {/* 红色圆点 */}
              <div className="absolute left-1 -top-1.5 w-3 h-3 rounded-full bg-red-500 shadow-sm" />
              {/* 红色线条 */}
              <div className="absolute left-4 right-0 h-0.5 bg-red-500 shadow-sm" />
              {/* 当前时间标签 */}
              <div className="absolute right-2 -top-2.5 px-1.5 py-0.5 bg-red-500 text-white text-xs font-medium rounded">
                {formatTime(new Date())}
              </div>
            </div>
          )}

          {/* 活动块 */}
          <div className="absolute left-14 right-2 top-0 bottom-0 z-10">
            {layoutActivities.map(activity => {
              const colors = activityColors[activity.type] || defaultColor
              // 创建一个可以传递给 onActivityClick 的对象（保持原始 API 类型）
              const originalActivity: Activity = {
                id: activity.id,
                type: activity.type,
                startTime: activity.startTime,
                endTime: activity.endTime,
                createdAt: activity.createdAt,
                updatedAt: activity.updatedAt,
                milkAmount: activity.milkAmount,
                hasPoop: activity.hasPoop,
                hasPee: activity.hasPee,
                poopColor: activity.poopColor,
                peeAmount: activity.peeAmount,
                supplementType: activity.supplementType,
                spitUpType: activity.spitUpType,
                notes: activity.notes,
              }

              // 线条类型（换尿布等）：显示为水平线 + 标签
              if (activity.isLineType) {
                return (
                  <button
                    key={activity.id}
                    onClick={() => onActivityClick?.(originalActivity)}
                    className="absolute left-0 right-0 group z-10 hover:z-20"
                    style={{ top: activity.top }}
                    data-testid={`timeline-activity-${activity.id}`}
                  >
                    {/* 水平线 */}
                    <div className={`absolute left-0 right-0 top-0 h-0.5 ${colors.divider} group-hover:h-1 transition-all -translate-y-1/2`} />
                    {/* 标签 */}
                    <div className={`absolute right-0 top-0 -translate-y-1/2 flex items-center gap-1 px-2 py-0.5 rounded-full ${colors.bg} ${colors.border} border shadow-sm group-hover:shadow-md transition-all`}>
                      <ActivityIcon
                        type={activity.type as ActivityType}
                        size={12}
                        className={colors.text}
                      />
                      <span className={`text-xs font-medium whitespace-nowrap ${colors.text}`}>
                        {getActivityLabel(activity)}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {formatTime(activity.startTimeDate)}
                      </span>
                    </div>
                  </button>
                )
              }

              // 块类型活动
              const isOutdoor = activity.type === 'OUTDOOR'
              const showGap = activity.type === 'BREASTFEED' || activity.type === 'BOTTLE'
              const gapMinutes = showGap ? gapSinceLastMap.get(activity.id) : undefined
              return (
                <div
                  key={activity.id}
                  className="absolute"
                  style={{
                    top: activity.top,
                    height: activity.height,
                    left: `${activity.left}%`,
                    width: `${activity.width}%`,
                  }}
                >
                  {/* 距上次间隔标签 */}
                  {gapMinutes != null && (
                    <div className="absolute -top-4 right-0 z-30 pointer-events-none">
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                        距上次{formatDuration(gapMinutes)}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={() => onActivityClick?.(originalActivity)}
                    className={`w-full h-full rounded-lg px-2 py-1 overflow-hidden transition-all hover:shadow-md ${colors.bg} ${isOutdoor
                        ? `border-2 border-dashed ${colors.border} z-[5] hover:z-[6]`
                        : `border-l-4 ${colors.border} hover:z-10`
                      }`}
                    style={{
                      ...(isOutdoor ? { opacity: 0.7 } : {}),
                    }}
                    data-testid={`timeline-activity-${activity.id}`}
                  >
                    <div className="flex items-center gap-1 h-full">
                      <ActivityIcon
                        type={activity.type as ActivityType}
                        size={activity.height > 40 ? 18 : 14}
                        className={colors.text}
                      />
                      <div className="flex-1 min-w-0 text-left">
                        <p className={`text-xs font-medium truncate ${colors.text}`}>
                          {getActivityLabel(activity)}
                        </p>
                        {activity.height > 40 && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatTime(activity.startTimeDate)}
                            {activity.duration > 0 ? ` - ${formatTime(activity.endTimeDate)}` : ''}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                </div>
              )
            })}
          </div>
        </TimelineGrid>
      </div>
    )
  }
)
