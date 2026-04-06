'use client'

import { Moon, Sun, Milk, Baby, Target, Droplet, Pill, Droplets, Dumbbell } from 'lucide-react'
import { ActivityType, ActivityTypeLabels } from '@/types/activity'
import type { SupplementType } from '@/types/activity'
import { ActivityIcon } from './ActivityIcon'
import { useSleepState } from '@/lib/api/hooks'

interface ActivityPickerProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (type: ActivityType | 'wake') => void
  onDiaperSelect: (diaperType: 'poop' | 'pee' | 'both') => void
  onSupplementSelect: (supplementType: SupplementType) => void
  /** 选中的默认时间（显示用） */
  selectedTime?: string
}

export function ActivityPicker({
  isOpen,
  onClose,
  onSelect,
  onDiaperSelect,
  onSupplementSelect,
  selectedTime,
}: ActivityPickerProps) {
  const { isSleeping, isFetching: sleepLoading } = useSleepState({ enabled: isOpen })

  if (!isOpen) return null

  return (
    <>
      {/* 遮罩层 */}
      <div 
        className="fixed inset-0 bg-black/40 z-40 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* 活动选择面板 */}
      <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-8 animate-in slide-in-from-bottom-4 fade-in duration-200">
        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-4 max-w-md md:max-w-lg mx-auto">
          {/* 选中时间提示 */}
          {selectedTime && (
            <div className="text-center mb-3 pb-3 border-b border-gray-100 dark:border-gray-800">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                添加活动到 <span className="font-semibold text-gray-700 dark:text-gray-200">{selectedTime}</span>
              </p>
            </div>
          )}

          {/* 睡眠区域 */}
          <section className="mb-4">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 px-1 flex items-center gap-1">
              <Moon size={14} />
              睡眠
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  onSelect(ActivityType.SLEEP)
                  onClose()
                }}
                disabled={isSleeping || sleepLoading}
                className="flex items-center gap-3 p-3 rounded-xl bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="picker-sleep-start"
              >
                <Moon size={24} />
                <span className="font-medium">入睡</span>
              </button>
              <button
                onClick={() => {
                  onSelect('wake')
                  onClose()
                }}
                disabled={sleepLoading}
                className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 disabled:opacity-50"
                data-testid="picker-sleep-end"
              >
                <Sun size={24} />
                <span className="font-medium">睡醒</span>
              </button>
            </div>
          </section>

          {/* 喂奶区域 */}
          <section className="mb-4">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 px-1 flex items-center gap-1">
              <Milk size={14} />
              喂奶
            </h3>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => {
                  onSelect(ActivityType.BREASTFEED)
                  onClose()
                }}
                className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300"
                data-testid="picker-breastfeed"
              >
                <ActivityIcon type={ActivityType.BREASTFEED} size={22} />
                <span className="text-xs font-medium">{ActivityTypeLabels[ActivityType.BREASTFEED]}</span>
              </button>
              <button
                onClick={() => {
                  onSelect(ActivityType.BOTTLE)
                  onClose()
                }}
                className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300"
                data-testid="picker-bottle"
              >
                <ActivityIcon type={ActivityType.BOTTLE} size={22} />
                <span className="text-xs font-medium">{ActivityTypeLabels[ActivityType.BOTTLE]}</span>
              </button>
              <button
                onClick={() => {
                  onSelect(ActivityType.PUMP)
                  onClose()
                }}
                className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-fuchsia-50 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-300"
                data-testid="picker-pump"
              >
                <ActivityIcon type={ActivityType.PUMP} size={22} />
                <span className="text-xs font-medium">{ActivityTypeLabels[ActivityType.PUMP]}</span>
              </button>
              <button
                onClick={() => {
                  onSelect(ActivityType.SPIT_UP)
                  onClose()
                }}
                className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                data-testid="picker-spitup"
              >
                <Droplets size={22} />
                <span className="text-xs font-medium">{ActivityTypeLabels[ActivityType.SPIT_UP]}</span>
              </button>
            </div>
          </section>

          {/* 换尿布区域 */}
          <section className="mb-4">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 px-1 flex items-center gap-1">
              <Baby size={14} />
              换尿布
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => {
                  onDiaperSelect('poop')
                  onClose()
                }}
                className="flex flex-col items-center gap-1 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                data-testid="picker-diaper-poop"
              >
                <span className="text-xl">💩</span>
                <span className="text-sm font-medium">大便</span>
              </button>
              <button
                onClick={() => {
                  onDiaperSelect('pee')
                  onClose()
                }}
                className="flex flex-col items-center gap-1 p-3 rounded-xl bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
                data-testid="picker-diaper-pee"
              >
                <Droplet size={24} />
                <span className="text-sm font-medium">小便</span>
              </button>
              <button
                onClick={() => {
                  onDiaperSelect('both')
                  onClose()
                }}
                className="flex flex-col items-center gap-1 p-3 rounded-xl bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300"
                data-testid="picker-diaper-both"
              >
                <span className="text-xl">💩💧</span>
                <span className="text-sm font-medium">大小便</span>
              </button>
            </div>
          </section>

          {/* 补剂区域 */}
          <section className="mb-4">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 px-1 flex items-center gap-1">
              <Pill size={14} />
              补剂
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  onSupplementSelect('AD')
                  onClose()
                }}
                className="flex items-center gap-3 p-3 rounded-xl bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
                data-testid="picker-supplement-ad"
              >
                <Pill size={24} />
                <span className="font-medium">AD</span>
              </button>
              <button
                onClick={() => {
                  onSupplementSelect('D3')
                  onClose()
                }}
                className="flex items-center gap-3 p-3 rounded-xl bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
                data-testid="picker-supplement-d3"
              >
                <Pill size={24} />
                <span className="font-medium">D3</span>
              </button>
              <button
                onClick={() => {
                  onSupplementSelect('PROBIOTICS')
                  onClose()
                }}
                className="flex items-center gap-3 p-3 rounded-xl bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                data-testid="picker-supplement-probiotics"
              >
                <Pill size={24} />
                <span className="font-medium">益生菌</span>
              </button>
              <button
                onClick={() => {
                  onSupplementSelect('PREBIOTICS')
                  onClose()
                }}
                className="flex items-center gap-3 p-3 rounded-xl bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300"
                data-testid="picker-supplement-prebiotics"
              >
                <Pill size={24} />
                <span className="font-medium">益生元</span>
              </button>
            </div>
          </section>

          {/* 运动区域 */}
          <section className="mb-4">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 px-1 flex items-center gap-1">
              <Dumbbell size={14} />
              运动
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {[
                ActivityType.HEAD_LIFT,
                ActivityType.PASSIVE_EXERCISE,
                ActivityType.ROLL_OVER,
                ActivityType.PULL_TO_SIT,
              ].map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    onSelect(type)
                    onClose()
                  }}
                  className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                  data-testid={`picker-activity-${type.toLowerCase().replace('_', '-')}`}
                >
                  <ActivityIcon type={type} size={22} />
                  <span className="text-xs font-medium text-center leading-tight">
                    {ActivityTypeLabels[type]}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* 其他活动区域 */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 px-1 flex items-center gap-1">
              <Target size={14} />
              其他活动
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {[
                ActivityType.GAS_EXERCISE,
                ActivityType.BATH,
                ActivityType.OUTDOOR,
                ActivityType.EARLY_EDUCATION,
              ].map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    onSelect(type)
                    onClose()
                  }}
                  className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300"
                  data-testid={`picker-activity-${type.toLowerCase().replace('_', '-')}`}
                >
                  <ActivityIcon type={type} size={22} />
                  <span className="text-xs font-medium text-center leading-tight">
                    {ActivityTypeLabels[type]}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
