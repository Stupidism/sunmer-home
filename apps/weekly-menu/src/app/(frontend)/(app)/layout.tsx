import { Navbar } from '@/components/Navbar'

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="phone-container mx-auto max-w-md min-h-screen bg-background">
      <Navbar />
      <main className="px-4 py-4">{children}</main>
    </div>
  )
}
