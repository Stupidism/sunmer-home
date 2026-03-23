import { Suspense } from 'react'
import { PrintWeekView } from '@/features/print/PrintWeekView'
import { Spinner } from '@bubu-log/ui/spinner'

export default function PrintWeekPage() {
  return (
    <div className="space-y-4 print:space-y-0">
      <h1 className="text-xl font-bold print:hidden">打印快照</h1>
      <Suspense
        fallback={
          <div className="flex justify-center py-12">
            <Spinner className="h-6 w-6" />
          </div>
        }
      >
        <PrintWeekView />
      </Suspense>
    </div>
  )
}
