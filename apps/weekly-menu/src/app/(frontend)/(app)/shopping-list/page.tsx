import { Suspense } from 'react'
import { ShoppingListView } from '@/features/shopping-list/ShoppingListView'
import { Spinner } from '@bubu-log/ui/spinner'

export default function ShoppingListPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">购物清单</h1>
      <Suspense
        fallback={
          <div className="flex justify-center py-12">
            <Spinner className="h-6 w-6" />
          </div>
        }
      >
        <ShoppingListView />
      </Suspense>
    </div>
  )
}
