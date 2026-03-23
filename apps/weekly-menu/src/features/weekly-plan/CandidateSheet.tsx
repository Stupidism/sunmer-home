'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@bubu-log/ui/sheet'
import { CategoryBadge } from './category-badge'
import type { GeneratedDish } from '@/lib/types'

type CandidateSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidates: GeneratedDish[]
  onSelect: (dish: GeneratedDish) => void
}

export function CandidateSheet({
  open,
  onOpenChange,
  candidates,
  onSelect,
}: CandidateSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[60vh] max-w-md w-full left-1/2 right-auto -translate-x-1/2 rounded-t-xl"
      >
        <SheetHeader>
          <SheetTitle>选择替换菜品</SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto mt-3 space-y-1 pb-safe">
          {candidates.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              没有可用候选
            </p>
          )}
          {candidates.map((c) => (
            <button
              key={c.dishId}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left hover:bg-muted active:scale-[0.98] active:opacity-80 transition-all"
              onClick={() => {
                onSelect(c)
                onOpenChange(false)
              }}
            >
              <CategoryBadge category={c.category} />
              <span className="text-sm flex-1">{c.name}</span>
              <span className="text-xs text-muted-foreground">{c.mainIngredient}</span>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
