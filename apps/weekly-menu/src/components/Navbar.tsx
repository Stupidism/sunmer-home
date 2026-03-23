'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  Home,
  History,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react'

const navItems = [
  { href: '/', label: '首页', icon: Home },
  { href: '/history', label: '历史', icon: History },
  { href: '/stats', label: '统计', icon: BarChart3 },
  { href: '/settings', label: '设置', icon: Settings },
] as const

export function Navbar() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' })
  }

  return (
    <nav className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="flex h-12 items-center justify-between px-4">
        <Link href="/" className="text-sm font-semibold">
          周菜单
        </Link>

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                isActive(href)
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="ml-2 flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-destructive transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            登出
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden p-1.5 text-muted-foreground"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? '关闭菜单' : '打开菜单'}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="sm:hidden border-t border-border bg-background animate-fade-in">
          <div className="flex flex-col py-2 px-4 gap-1">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive(href)
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-destructive transition-colors"
            >
              <LogOut className="h-4 w-4" />
              登出
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}
