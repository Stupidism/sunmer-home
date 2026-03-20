'use client'

import { useCallback, useRef } from 'react'
import { Edit2, Trash2, Loader2, CalendarDays } from 'lucide-react'
import { BottomSheet } from '@/components/BottomSheet'
import { ActivityIcon } from '@/components/ActivityIcon'
import { useModalParams } from '@/hooks/useModalParams'
import { useActivity, useUpdateActivity } from '@/lib/api/hooks'
import { ActivityType, ActivityTypeLabels, PoopColorStyles, PoopColorLabels, PeeAmountLabels, PoopColor, PeeAmount, BreastFirmness, BreastFirmnessLabels, SupplementType, SupplementTypeLabels, SpitUpType, SpitUpTypeLabels, MilkSource, MilkSourceLabels } from '@/types/activity'
import {
  DiaperForm,
  BreastfeedForm,
  BottleForm,
  PumpForm,
  ActivityDurationForm,
  CountActivityForm,
  SleepEndForm,
  SupplementForm,
  SpitUpForm,
} from '@/components/forms'
import type { components } from '@/lib/api/openapi-types'
import { dayjs, calculateDurationMinutes, formatDuration, formatDateTimeChinese } from '@/lib/dayjs'

export function ActivityDetailModal() {
  const { modalType, activityId, isEditing, closeModal, setEditing, openModal } = useModalParams()
  
  // 只有当 modal=activity 且有 id 时才获取数据
  const shouldFetch = modalType === 'activity' && !!activityId
  const { data: activity, isLoading } = useActivity(activityId || '', {
    enabled: shouldFetch,
  })
  
  const updateActivity = useUpdateActivity()
  
  const isOpen = modalType === 'activity' && !!activityId
  
  // 关闭弹窗
  const handleClose = useCallback(() => {
    closeModal()
  }, [closeModal])
  
  // 开始编辑
  const handleEdit = useCallback(() => {
    setEditing(true)
  }, [setEditing])
  
  // 改日期（保留时间）
  const dateInputRef = useRef<HTMLInputElement>(null)

  const handleChangeDateClick = useCallback(() => {
    dateInputRef.current?.showPicker()
  }, [])

  const handleDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activityId || !activity || !e.target.value || updateActivity.isPending) return

    const newDate = dayjs(e.target.value)
    const origStart = dayjs(activity.startTime)
    const newStart = origStart.year(newDate.year()).month(newDate.month()).date(newDate.date())

    const body: Record<string, string> = {
      startTime: newStart.toISOString(),
    }

    if (activity.endTime) {
      const origEnd = dayjs(activity.endTime)
      const dayOffset = origEnd.diff(origStart, 'day')
      const newEnd = origEnd.year(newDate.year()).month(newDate.month()).date(newDate.date() + dayOffset)
      body.endTime = newEnd.toISOString()
    }

    updateActivity.mutate(
      {
        params: { path: { id: activityId } },
        body,
      },
      {
        onSuccess: () => {
          handleClose()
        },
      }
    )
  }, [activityId, activity, updateActivity, handleClose])

  // 打开删除确认
  const handleDeleteClick = useCallback(() => {
    if (activityId) {
      openModal('delete', { id: activityId })
    }
  }, [activityId, openModal])
  
  // 提交编辑
  const handleSubmit = useCallback(async (data: Record<string, unknown>) => {
    if (!activityId || updateActivity.isPending) return
    
    updateActivity.mutate(
      {
        params: { path: { id: activityId } },
        body: {
          startTime: (data.startTime as Date).toISOString(),
          ...(data.endTime !== undefined && { endTime: (data.endTime as Date).toISOString() }),
          ...(data.hasPoop !== undefined && { hasPoop: data.hasPoop as boolean }),
          ...(data.hasPee !== undefined && { hasPee: data.hasPee as boolean }),
          ...(data.poopColor !== undefined && { poopColor: data.poopColor as components["schemas"]["PoopColor"] }),
          ...(data.poopPhotoUrl !== undefined && { poopPhotoUrl: data.poopPhotoUrl as string }),
          ...(data.peeAmount !== undefined && { peeAmount: data.peeAmount as components["schemas"]["PeeAmount"] }),
          ...(data.burpSuccess !== undefined && { burpSuccess: data.burpSuccess as boolean }),
          ...(data.breastFirmness !== undefined && { breastFirmness: data.breastFirmness as components["schemas"]["BreastFirmness"] }),
          ...(data.milkAmount !== undefined && { milkAmount: data.milkAmount as number }),
          ...(data.supplementType !== undefined && { supplementType: data.supplementType as components["schemas"]["SupplementType"] }),
          ...(data.spitUpType !== undefined && { spitUpType: data.spitUpType as components["schemas"]["SpitUpType"] }),
          ...(data.notes !== undefined && { notes: data.notes as string }),
        },
      },
      {
        onSuccess: () => {
          handleClose()
        },
      }
    )
  }, [activityId, updateActivity, handleClose])
  
  // 格式化时间范围
  const formatTimeRange = (startTime: Date | string, endTime: Date | string) => {
    return `${dayjs(startTime).format('HH:mm')} - ${dayjs(endTime).format('HH:mm')}`
  }
  
  // 渲染通用时间信息
  const renderTimeInfo = () => {
    if (!activity) return null
    const duration = activity.endTime
      ? calculateDurationMinutes(activity.startTime, activity.endTime)
      : null

    // 正在进行的睡觉
    if (activity.type === 'SLEEP' && !activity.endTime) {
      return <p className="text-lg text-sky-600 dark:text-sky-400">正在睡觉...</p>
    }

    return (
      <p className="text-lg text-gray-700 dark:text-gray-300">
        {dayjs(activity.startTime).format('HH:mm')}
        {activity.endTime && ` - ${dayjs(activity.endTime).format('HH:mm')}`}
        {duration ? ` · ${formatDuration(duration)}` : ''}
      </p>
    )
  }

  // 渲染活动详情（类型特有信息）
  const renderDetails = () => {
    if (!activity) return null

    switch (activity.type) {
      case 'SLEEP':
        return null // 时间信息已由 renderTimeInfo 显示

      case 'BREASTFEED':
        return (
          <div className="space-y-1">
            {activity.burpSuccess !== null && (
              <p className={activity.burpSuccess ? 'text-green-600' : 'text-red-600'}>
                {activity.burpSuccess ? '拍嗝成功' : '拍嗝未成功'}
              </p>
            )}
            {activity.breastFirmness && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                乳房硬度：{BreastFirmnessLabels[activity.breastFirmness as BreastFirmness]}
              </p>
            )}
          </div>
        )

      case 'BOTTLE':
        return (
          <div className="space-y-1">
            <p className="text-lg text-gray-700 dark:text-gray-300">
              {activity.milkAmount ? `${activity.milkAmount}ml` : '未记录奶量'}
              {activity.milkSource && ` · ${MilkSourceLabels[activity.milkSource as MilkSource]}`}
            </p>
            {activity.burpSuccess !== null && (
              <p className={activity.burpSuccess ? 'text-green-600' : 'text-red-600'}>
                {activity.burpSuccess ? '拍嗝成功' : '拍嗝未成功'}
              </p>
            )}
          </div>
        )

      case 'PUMP':
        return (
          <p className="text-lg text-gray-700 dark:text-gray-300">
            {activity.milkAmount ? `${activity.milkAmount}ml` : '未记录奶量'}
          </p>
        )

      case 'DIAPER':
        return (
          <div className="space-y-2">
            {activity.hasPoop && (
              <div className="flex items-center gap-2">
                <span className="text-lg">大便</span>
                {activity.poopColor && (
                  <span className="flex items-center gap-2">
                    <span
                      className={`w-4 h-4 rounded-full ${PoopColorStyles[activity.poopColor as PoopColor] || ''}`}
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {PoopColorLabels[activity.poopColor as PoopColor] || activity.poopColor}
                    </span>
                  </span>
                )}
              </div>
            )}
            {activity.hasPee && (
              <p className="text-lg text-gray-700 dark:text-gray-300">
                小便{activity.peeAmount ? ` - ${PeeAmountLabels[activity.peeAmount as PeeAmount]}` : ''}
              </p>
            )}
            {!activity.hasPoop && !activity.hasPee && (
              <p className="text-lg text-gray-500">只换尿布</p>
            )}
          </div>
        )

      case 'SUPPLEMENT':
        return (
          <p className="text-lg text-gray-700 dark:text-gray-300">
            {activity.supplementType ? SupplementTypeLabels[activity.supplementType as SupplementType] : '未记录类型'}
          </p>
        )

      case 'SPIT_UP':
        return (
          <p className="text-lg text-gray-700 dark:text-gray-300">
            {activity.spitUpType ? SpitUpTypeLabels[activity.spitUpType as SpitUpType] : '未记录类型'}
          </p>
        )

      case 'ROLL_OVER':
      case 'PULL_TO_SIT':
        return (
          <p className="text-lg text-gray-700 dark:text-gray-300">
            {activity.count ? `${activity.count} 次` : '未记录次数'}
          </p>
        )

      default:
        return null
    }
  }
  
  // 渲染编辑表单
  const renderEditForm = () => {
    if (!activity) return null
    
    const activityType = activity.type as ActivityType
    const baseValues = {
      startTime: new Date(activity.startTime),
      endTime: activity.endTime ? new Date(activity.endTime) : undefined,
      milkAmount: activity.milkAmount || undefined,
      hasPoop: activity.hasPoop ?? undefined,
      hasPee: activity.hasPee ?? undefined,
      poopColor: activity.poopColor as PoopColor | undefined,
      peeAmount: activity.peeAmount as PeeAmount | undefined,
      burpSuccess: activity.burpSuccess ?? undefined,
      breastFirmness: (activity.breastFirmness as BreastFirmness) || 'SOFT',
    }
    
    switch (activityType) {
      case ActivityType.DIAPER:
        return (
          <DiaperForm
            onSubmit={handleSubmit}
            onCancel={handleClose}
            initialValues={baseValues}
            isEditing
          />
        )
      case ActivityType.BREASTFEED:
        return (
          <BreastfeedForm
            onSubmit={handleSubmit}
            onCancel={handleClose}
            initialValues={baseValues}
            isEditing
          />
        )
      case ActivityType.BOTTLE:
        return (
          <BottleForm
            onSubmit={handleSubmit}
            onCancel={handleClose}
            initialValues={{
              ...baseValues,
              milkSource: activity.milkSource as MilkSource | undefined,
            }}
            isEditing
          />
        )
      case ActivityType.PUMP:
        return (
          <PumpForm
            onSubmit={handleSubmit}
            onCancel={handleClose}
            initialValues={baseValues}
            isEditing
          />
        )
      case ActivityType.SLEEP:
        return (
          <SleepEndForm
            onSubmit={handleSubmit}
            onCancel={handleClose}
            initialValues={baseValues}
            isEditing
          />
        )
      case ActivityType.HEAD_LIFT:
      case ActivityType.PASSIVE_EXERCISE:
      case ActivityType.GAS_EXERCISE:
      case ActivityType.BATH:
      case ActivityType.OUTDOOR:
      case ActivityType.EARLY_EDUCATION:
        return (
          <ActivityDurationForm
            type={activityType}
            onSubmit={handleSubmit}
            onCancel={handleClose}
            initialValues={baseValues}
            isEditing
          />
        )
      case ActivityType.SUPPLEMENT:
        return (
          <SupplementForm
            onSubmit={handleSubmit}
            onCancel={handleClose}
            initialValues={{
              ...baseValues,
              supplementType: activity.supplementType as SupplementType | undefined,
            }}
            isEditing
          />
        )
      case ActivityType.SPIT_UP:
        return (
          <SpitUpForm
            onSubmit={handleSubmit}
            onCancel={handleClose}
            initialValues={{
              ...baseValues,
              spitUpType: activity.spitUpType as SpitUpType | undefined,
            }}
            isEditing
          />
        )
      case ActivityType.ROLL_OVER:
      case ActivityType.PULL_TO_SIT:
        return (
          <CountActivityForm
            type={activityType}
            onSubmit={handleSubmit}
            onCancel={handleClose}
            initialValues={{
              ...baseValues,
              count: activity.count || undefined,
            }}
            isEditing
          />
        )
      default:
        return null
    }
  }
  
  if (!isOpen) return null
  
  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditing ? '编辑记录' : (activity ? ActivityTypeLabels[activity.type as ActivityType] : '加载中...')}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : activity ? (
        isEditing ? (
          renderEditForm()
        ) : (
          <div className="space-y-6">
            {/* 活动信息 */}
            <div className="text-center">
              <ActivityIcon 
                type={activity.type as ActivityType} 
                size={56} 
                className="text-gray-600 dark:text-gray-300 mx-auto" 
              />
              <h3 className="text-2xl font-bold mt-3 text-gray-800 dark:text-gray-100">
                {ActivityTypeLabels[activity.type as ActivityType]}
              </h3>
              <p className="text-xl text-gray-500 dark:text-gray-400 mt-1">
                {formatDateTimeChinese(activity.startTime)}
              </p>
            </div>

            {/* 详细信息 */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 space-y-2">
              {renderTimeInfo()}
              {renderDetails()}
              {activity.notes && (
                <p className="mt-2 text-base text-gray-600 dark:text-gray-400">
                  备注: {activity.notes}
                </p>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="grid grid-cols-4 gap-3">
              <button
                onClick={handleEdit}
                className="p-4 rounded-2xl bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold text-base flex flex-col items-center justify-center gap-1"
              >
                <Edit2 size={20} />
                编辑
              </button>
              <button
                onClick={handleChangeDateClick}
                disabled={updateActivity.isPending}
                className="p-4 rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-semibold text-base flex flex-col items-center justify-center gap-1 disabled:opacity-50"
              >
                <CalendarDays size={20} />
                改日期
              </button>
              <input
                ref={dateInputRef}
                type="date"
                className="sr-only"
                defaultValue={activity ? dayjs(activity.startTime).format('YYYY-MM-DD') : ''}
                onChange={handleDateChange}
              />
              <button
                onClick={handleDeleteClick}
                className="p-4 rounded-2xl bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-semibold text-base flex flex-col items-center justify-center gap-1"
              >
                <Trash2 size={20} />
                删除
              </button>
              <button
                onClick={handleClose}
                className="p-4 rounded-2xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold text-base"
              >
                关闭
              </button>
            </div>
          </div>
        )
      ) : (
        <div className="text-center py-12 text-gray-500">
          未找到活动记录
        </div>
      )}
    </BottomSheet>
  )
}
