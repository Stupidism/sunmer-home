import { Suspense } from 'react'
import { HistoryList } from '@/features/history/HistoryList'
import { Spinner } from '@bubu-log/ui/spinner'

export default function HistoryPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">历史计划</h1>
      <Suspense
        fallback={
          <div className="flex justify-center py-12">
            <Spinner className="h-6 w-6" />
          </div>
        }
      >
        <HistoryList />
      </Suspense>
    </div>
  )
}
