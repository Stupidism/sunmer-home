import type { Metadata, Viewport } from 'next'
import '../globals.css'
import { Providers } from '../providers'
import { Toaster } from '@bubu-log/ui/sonner'

export const metadata: Metadata = {
  title: '周菜单',
  description: '单人周菜单规划应用',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f5f5' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1a2e' },
  ],
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
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased min-h-screen">
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
