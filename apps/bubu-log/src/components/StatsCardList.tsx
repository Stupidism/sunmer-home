'use client'

export type StatFilter =
  | 'sleep'
  | 'bottle'
  | 'breastfeed'
  | 'pump'
  | 'diaper'
  | 'outdoor'
  | 'headLift'
  | 'rollOver'

export interface DaySummary {
  sleepCount: number
  totalSleepMinutes: number
  totalBottleMilkAmount: number
  totalBreastfeedMinutes: number
  totalPumpMilkAmount: number
  diaperCount: number
  largePeeDiaperCount: number
  smallMediumPeeDiaperCount: number
  totalOutdoorMinutes: number
  totalHeadLiftMinutes: number
  totalRollOverCount: number
  totalPullToSitCount: number
}

interface StatsCardListProps {
  summary: DaySummary
  activeFilters?: StatFilter[]
  onStatCardClick?: (filter: StatFilter) => void
}

interface CardTone {
  active: string
  inactive: string
}

function formatSleepDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const minutePart = String(minutes % 60).padStart(2, '0')
  return `${hours}:${minutePart}`
}

export function StatsCardList({
  summary,
  activeFilters = [],
  onStatCardClick,
}: StatsCardListProps) {
  const activeFilterSet = new Set(activeFilters)
  const normalizedPeeCount = summary.largePeeDiaperCount + Math.ceil(summary.smallMediumPeeDiaperCount / 2)

  const toneByFilter: Record<StatFilter, CardTone> = {
    sleep: {
      active: 'border-sky-500 bg-sky-100 text-sky-800 dark:border-sky-400 dark:bg-sky-900/60 dark:text-sky-200',
      inactive: 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-900/40',
    },
    bottle: {
      active: 'border-pink-500 bg-pink-100 text-pink-800 dark:border-pink-400 dark:bg-pink-900/60 dark:text-pink-200',
      inactive: 'border-pink-200 bg-pink-50 text-pink-700 hover:bg-pink-100 dark:border-pink-800 dark:bg-pink-950/40 dark:text-pink-300 dark:hover:bg-pink-900/40',
    },
    breastfeed: {
      active: 'border-rose-500 bg-rose-100 text-rose-800 dark:border-rose-400 dark:bg-rose-900/60 dark:text-rose-200',
      inactive: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/40',
    },
    pump: {
      active: 'border-fuchsia-500 bg-fuchsia-100 text-fuchsia-800 dark:border-fuchsia-400 dark:bg-fuchsia-900/60 dark:text-fuchsia-200',
      inactive: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100 dark:border-fuchsia-800 dark:bg-fuchsia-950/40 dark:text-fuchsia-300 dark:hover:bg-fuchsia-900/40',
    },
    diaper: {
      active: 'border-yellow-500 bg-yellow-100 text-yellow-900 dark:border-yellow-400 dark:bg-yellow-900/60 dark:text-yellow-200',
      inactive: 'border-yellow-200 bg-yellow-50 text-yellow-800 hover:bg-yellow-100 dark:border-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300 dark:hover:bg-yellow-900/40',
    },
    outdoor: {
      active: 'border-amber-600 bg-amber-100 text-amber-900 dark:border-amber-500 dark:bg-amber-900/60 dark:text-amber-200',
      inactive: 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/40',
    },
    headLift: {
      active: 'border-orange-500 bg-orange-100 text-orange-900 dark:border-orange-400 dark:bg-orange-900/60 dark:text-orange-200',
      inactive: 'border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300 dark:hover:bg-orange-900/40',
    },
    rollOver: {
      active: 'border-orange-600 bg-orange-100 text-orange-900 dark:border-orange-500 dark:bg-orange-900/60 dark:text-orange-200',
      inactive: 'border-orange-300 bg-orange-50 text-orange-800 hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300 dark:hover:bg-orange-900/40',
    },
  }

  const cards: Array<{ key: StatFilter; label: string; value: string; testId: string; tone: CardTone }> = [
    { key: 'sleep', label: '睡', value: formatSleepDuration(summary.totalSleepMinutes), testId: 'stat-card-sleep', tone: toneByFilter.sleep },
    { key: 'bottle', label: '瓶', value: `${summary.totalBottleMilkAmount} ml`, testId: 'stat-card-bottle', tone: toneByFilter.bottle },
    { key: 'breastfeed', label: '亲', value: `${summary.totalBreastfeedMinutes} min`, testId: 'stat-card-breastfeed', tone: toneByFilter.breastfeed },
    { key: 'pump', label: '吸', value: `${summary.totalPumpMilkAmount} ml`, testId: 'stat-card-pump', tone: toneByFilter.pump },
    { key: 'diaper', label: '尿', value: `${normalizedPeeCount} 次`, testId: 'stat-card-diaper', tone: toneByFilter.diaper },
    { key: 'outdoor', label: '阳', value: `${summary.totalOutdoorMinutes} min`, testId: 'stat-card-outdoor', tone: toneByFilter.outdoor },
    { key: 'headLift', label: '趴', value: `${summary.totalHeadLiftMinutes} min`, testId: 'stat-card-head-lift', tone: toneByFilter.headLift },
    { key: 'rollOver', label: '翻', value: `${summary.totalRollOverCount} 次`, testId: 'stat-card-roll-over', tone: toneByFilter.rollOver },
  ]

  return (
    <div className="grid grid-cols-4 md:grid-cols-8 gap-1 md:gap-2">
      {cards.map((card) => {
        const isActive = activeFilterSet.has(card.key)
        return (
          <button
            key={card.key}
            onClick={() => onStatCardClick?.(card.key)}
            className={`rounded-md border px-2 py-1 text-left transition-colors ${isActive ? card.tone.active : card.tone.inactive}`}
            data-testid={card.testId}
          >
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-medium leading-none">{card.label}</span>
              <span className="flex-1 truncate text-right text-[11px] font-semibold leading-none whitespace-nowrap">{card.value}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
