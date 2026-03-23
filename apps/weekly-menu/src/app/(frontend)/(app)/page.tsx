import { Suspense } from 'react'
import { WeeklyPlanView } from '@/features/weekly-plan/WeeklyPlanView'
import { Spinner } from '@bubu-log/ui/spinner'

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <Spinner className="h-6 w-6" />
        </div>
      }
    >
      <WeeklyPlanView />
    </Suspense>
  )
}
