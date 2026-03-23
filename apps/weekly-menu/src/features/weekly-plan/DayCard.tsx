'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@bubu-log/ui/card'
import { CategoryBadge } from './category-badge'
import { RotateButton } from './RotateButton'
import type { GeneratedSlot, GeneratedDish, DishCategory } from '@/lib/types'

const dayLabels = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']
const mealLabels = { LUNCH: '午餐', DINNER: '晚餐' } as const

type DayCardProps = {
  dayOfWeek: number
  lunchSlot: GeneratedSlot | null
  dinnerSlot: GeneratedSlot | null
  isLocked: boolean
  onRotate: (slotIndex: number, dishIndex: number, category: DishCategory) => void
  lunchSlotIndex: number
  dinnerSlotIndex: number
  dateStr?: string
}

function MealSection({
  label,
  slot,
  isLocked,
  slotIndex,
  onRotate,
}: {
  label: string
  slot: GeneratedSlot | null
  isLocked: boolean
  slotIndex: number
  onRotate: (slotIndex: number, dishIndex: number, category: DishCategory) => void
}) {
  if (!slot || slot.dishes.length === 0) {
    return (
      <div className="py-1">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <p className="text-xs text-muted-foreground/60 mt-0.5">暂无</p>
      </div>
    )
  }

  return (
    <div className="py-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-0.5 space-y-0.5">
        {slot.dishes.map((dish: GeneratedDish, i: number) => (
          <div key={`${dish.dishId}-${i}`} className="flex items-center gap-1.5">
            <CategoryBadge category={dish.category} />
            <span className="text-sm flex-1 truncate">{dish.name}</span>
            {!isLocked && (
              <RotateButton
                onClick={() => onRotate(slotIndex, i, dish.category)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function DayCard({
  dayOfWeek,
  lunchSlot,
  dinnerSlot,
  isLocked,
  onRotate,
  lunchSlotIndex,
  dinnerSlotIndex,
  dateStr,
}: DayCardProps) {
  return (
    <Card className="animate-fade-in">
      <CardHeader className="pb-1 pt-3 px-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          {dayLabels[dayOfWeek]}
          {dateStr && (
            <span className="text-xs font-normal text-muted-foreground">{dateStr}</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-1 divide-y divide-border/50">
        <MealSection
          label={mealLabels.LUNCH}
          slot={lunchSlot}
          isLocked={isLocked}
          slotIndex={lunchSlotIndex}
          onRotate={onRotate}
        />
        <MealSection
          label={mealLabels.DINNER}
          slot={dinnerSlot}
          isLocked={isLocked}
          slotIndex={dinnerSlotIndex}
          onRotate={onRotate}
        />
      </CardContent>
    </Card>
  )
}
