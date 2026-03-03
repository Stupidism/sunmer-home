import type { Metadata, Viewport } from 'next'
import '../globals.css'
import { Toaster } from '@/components/ui/sonner'

export const metadata: Metadata = {
  title: '我们结婚啦 - 婚礼邀请',
  description: '诚邀您见证我们的幸福时刻',
  icons: {
    icon: [{ url: '/favicon.ico', sizes: '32x32' }],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FDF6F0' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1a2e' },
  ],
}

export default function FrontendLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700&family=Playfair+Display:wght@400;500;600;700&display=swap"
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
