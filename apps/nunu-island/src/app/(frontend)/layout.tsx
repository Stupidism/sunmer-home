import type { Metadata, Viewport } from 'next'
import '../globals.css'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: 'Nunu Island',
  description: '心理记录与觉察工具',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased min-h-screen">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
