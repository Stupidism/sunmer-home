'use client'

import { useMemo, useRef, useImperativeHandle, forwardRef, useEffect, useState } from 'react'
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

// 活动类型对应的颜色
const activityColors: Record<string, { bg: string; border: string; text: string; divider?: string }> = {
  SLEEP: { bg: 'bg-sky-100 dark:bg-sky-900/40', border: 'border-sky-400', text: 'text-sky-700 dark:text-sky-300' },
  BREASTFEED: { bg: 'bg-rose-100 dark:bg-rose-900/40', border: 'border-rose-400', text: 'text-rose-700 dark:text-rose-300' },
  BOTTLE: { bg: 'bg-pink-100 dark:bg-pink-900/40', border: 'border-pink-400', text: 'text-pink-700 dark:text-pink-300' },
  PUMP: { bg: 'bg-fuchsia-100 dark:bg-fuchsia-900/40', border: 'border-fuchsia-400', text: 'text-fuchsia-700 dark:text-fuchsia-300' },
  DIAPER: { bg: 'bg-yellow-100 dark:bg-yellow-900/40', border: 'border-yellow-400', text: 'text-yellow-800 dark:text-yellow-300', divider: 'bg-yellow-500' },
  HEAD_LIFT: { bg: 'bg-amber-100 dark:bg-amber-900/40', border: 'border-amber-400', text: 'text-amber-700 dark:text-amber-300' },
  PASSIVE_EXERCISE: { bg: 'bg-orange-100 dark:bg-orange-900/40', border: 'border-orange-400', text: 'text-orange-700 dark:text-orange-300' },
  GAS_EXERCISE: { bg: 'bg-amber-100 dark:bg-amber-900/40', border: 'border-amber-400', text: 'text-amber-700 dark:text-amber-300' },
  BATH: { bg: 'bg-yellow-100 dark:bg-yellow-900/40', border: 'border-yellow-400', text: 'text-yellow-800 dark:text-yellow-300' },
  OUTDOOR: { bg: 'bg-amber-100 dark:bg-amber-900/40', border: 'border-amber-500', text: 'text-amber-700 dark:text-amber-300' },
  EARLY_EDUCATION: { bg: 'bg-orange-100 dark:bg-orange-900/40', border: 'border-orange-400', text: 'text-orange-700 dark:text-orange-300' },
  ROLL_OVER: { bg: 'bg-amber-100 dark:bg-amber-900/40', border: 'border-amber-400', text: 'text-amber-700 dark:text-amber-300' },
  PULL_TO_SIT: { bg: 'bg-orange-100 dark:bg-orange-900/40', border: 'border-orange-400', text: 'text-orange-700 dark:text-orange-300' },
  SUPPLEMENT: { bg: 'bg-orange-100 dark:bg-orange-900/40', border: 'border-orange-400', text: 'text-orange-700 dark:text-orange-300', divider: 'bg-orange-400' },
  SPIT_UP: { bg: 'bg-red-100 dark:bg-red-900/40', border: 'border-red-400', text: 'text-red-700 dark:text-red-300', divider: 'bg-red-400' },
}

const defaultColor = { bg: 'bg-gray-100 dark:bg-gray-800', border: 'border-gray-400', text: 'text-gray-700 dark:text-gray-300' }

// 每小时的高度（像素）
const HOUR_HEIGHT = 60
// 有时长活动的最小高度（确保能显示内容）
const MIN_DURATION_BLOCK_HEIGHT = 15
// 线条类型活动（换尿布）不需要时长

export const DayTimeline = forwardRef<DayTimelineRef, DayTimelineProps>(
  function DayTimeline({ activities, date, onActivityClick, showCurrentTime = false, onLongPressBlank }, ref) {
    const currentTimeRef = useRef<HTMLDivElement>(null)
    const [currentMinutes, setCurrentMinutes] = useState(() => {
      const now = new Date()
      return now.getHours() * 60 + now.getMinutes()
    })

    const currentTime = useMemo(() => {
      if (!showCurrentTime) return null

      const now = new Date()
      now.setHours(Math.floor(currentMinutes / 60), currentMinutes % 60, 0, 0)
      return dayjs(now)
    }, [showCurrentTime, currentMinutes])

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

    // 计算活动在时间线上的位置
    const positionedActivities = useMemo(() => {
      const dayStart = dayjs(date).startOf('day')
      const dayEnd = dayStart.add(1, 'day')

      return activities.map(activity => {
        const startTime = dayjs(activity.startTime)

        // 换尿布、补剂、吐奶是瞬时事件，显示为线条
        const isLineType = activity.type === 'DIAPER' || activity.type === 'SUPPLEMENT' || activity.type === 'SPIT_UP'

        // 计算时长：有 endTime 则计算差值，否则默认 5 分钟（非线条类型）
        const duration = activity.endTime
          ? calculateDurationMinutes(activity.startTime, activity.endTime)
          : (isLineType ? 0 : 5)

        // 跨天活动在时间线里要裁剪到当天，避免按钮的可点击中心落到可视区域外被上层元素拦截
        const visualStart = startTime.isBefore(dayStart) ? dayStart : startTime
        const rawEndTime = activity.endTime ? dayjs(activity.endTime) : startTime.add(Math.max(duration, 1), 'minute')
        const visualEnd = rawEndTime.isAfter(dayEnd) ? dayEnd : rawEndTime
        const visualMinutesFromStart = visualStart.diff(dayStart, 'minute')
        const top = (visualMinutesFromStart / 60) * HOUR_HEIGHT
        const visualDurationMinutes = Math.max(visualEnd.diff(visualStart, 'minute'), isLineType ? 0 : 1)

        // 线条类型固定高度为 2px，其他按时长计算（有最小高度确保可点击）
        const height = isLineType
          ? 2
          : Math.max((visualDurationMinutes / 60) * HOUR_HEIGHT, MIN_DURATION_BLOCK_HEIGHT)

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
    }, [activities, date])

    // 处理重叠的活动（简单实现：按顺序排列）
    const layoutActivities = useMemo(() => {
      const result: Array<typeof positionedActivities[0] & { left: number; width: number }> = []

      for (const activity of positionedActivities) {
        // 线条类型不参与重叠计算，始终全宽
        if (activity.isLineType) {
          result.push({ ...activity, left: 0, width: 100 })
          continue
        }

        // 户外活动总是在右边（因为户外时可以睡觉、换尿布等）
        if (activity.type === 'OUTDOOR') {
          result.push({ ...activity, left: 50, width: 48 })
          continue
        }

        // 检查是否与已有的非线条、非户外活动重叠
        const overlapping = result.filter(
          a => !a.isLineType && a.type !== 'OUTDOOR' && !(activity.top >= a.top + a.height || activity.top + activity.height <= a.top)
        )

        // 简单处理：如果重叠，缩小宽度并偏移
        const left = overlapping.length > 0 ? 50 : 0
        const width = overlapping.length > 0 ? 48 : 100

        result.push({ ...activity, left, width })
      }

      return result
    }, [positionedActivities])

    // 计算每个睡觉/喂奶活动距上次同类活动的间隔
    const gapSinceLastMap = useMemo(() => {
      const map = new Map<string, number>() // activity id -> gap in minutes

      // 按开始时间排序的睡觉活动
      const sleepActivities = activities
        .filter(a => a.type === 'SLEEP')
        .sort((a, b) => dayjs(a.startTime).valueOf() - dayjs(b.startTime).valueOf())
      for (let i = 1; i < sleepActivities.length; i++) {
        const prev = sleepActivities[i - 1]
        const curr = sleepActivities[i]
        const prevEnd = prev.endTime || prev.startTime
        const gap = dayjs(curr.startTime).diff(dayjs(prevEnd), 'minute')
        if (gap > 0) map.set(curr.id, gap)
      }

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
      if (!currentTime) return null
      const now = currentTime
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
    }, [activities, currentTime])

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
        // 显示补剂类型
        if (activity.supplementType) {
          label = activity.supplementType
        }
      } else if (activity.type === 'SPIT_UP') {
        // 显示吐奶类型
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
    const currentTimeTop = (currentMinutes / 60) * HOUR_HEIGHT

    return (
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl overflow-hidden">
        <TimelineGrid
          date={date}
          hourHeight={HOUR_HEIGHT}
          showHalfHours
          onLongPressBlank={onLongPressBlank}
          className="relative"
        >
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
                    <span className="text-[10px] text-sky-500 whitespace-nowrap">
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
          <div className="absolute left-14 right-2 top-0 bottom-0">
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

              // 线条类型（换尿布）：显示为水平线 + 标签
              if (activity.isLineType) {
                return (
                  <button
                    key={activity.id}
                    onClick={() => onActivityClick?.(originalActivity)}
                    className="absolute left-0 right-0 group z-10 hover:z-20"
                    style={{ top: activity.top }}
                    data-testid={`timeline-activity-${activity.id}`}
                  >
                    {/* 水平线 - 绝对定位在顶部，确保线条对准时间点 */}
                    <div className={`absolute left-0 right-0 top-0 h-0.5 ${colors.divider} group-hover:h-1 transition-all -translate-y-1/2`} />
                    {/* 标签 - 在线条右侧，垂直居中于线条 */}
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

              // 块类型（睡眠、喂奶等）：严格按时长显示高度
              // 户外活动：虚线边框、半透明、悬浮在其他色块之上但在换尿布线下面
              const isOutdoor = activity.type === 'OUTDOOR'
              const showGap = activity.type === 'SLEEP' || activity.type === 'BREASTFEED' || activity.type === 'BOTTLE'
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
                  {/* 距上次间隔标签 - 卡片外部右上角 */}
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
