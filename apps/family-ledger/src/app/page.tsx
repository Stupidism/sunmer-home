import LedgerPage from './LedgerPage'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  return <LedgerPage view="overview" />
}
