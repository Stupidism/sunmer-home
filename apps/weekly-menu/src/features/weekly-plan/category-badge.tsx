import { Badge } from '@bubu-log/ui/badge'
import type { DishCategory } from '@/lib/types'

const labelByCategory: Record<DishCategory, string> = {
  MEAT: '荤',
  LEAFY_GREEN: '素',
  OTHER: '其他',
}

const colorByCategory: Record<DishCategory, string> = {
  MEAT: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  LEAFY_GREEN: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  OTHER: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
}

export function CategoryBadge({ category }: { category: DishCategory }) {
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${colorByCategory[category]}`}>
      {labelByCategory[category]}
    </Badge>
  )
}
