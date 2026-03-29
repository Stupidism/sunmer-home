'use client'

import { type ComponentType, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@bubu-log/ui/sheet'
import { Baby, ClipboardList, FileUp, History, House, Menu, Settings, TrendingUp } from 'lucide-react'
import { buildBabyScopedPath } from '@/lib/baby-scope'

type DrawerItem = {
  key: string
  label: string
  href: string
  exact?: boolean
  icon: ComponentType<{ size?: number; className?: string }>
}

interface AppDrawerMenuProps {
  babyId: string
}

function isActive(pathname: string, href: string, exact = false): boolean {
  if (pathname === href) {
    return true
  }

  if (exact) {
    return false
  }

  return pathname.startsWith(`${href}/`)
}

export function AppDrawerMenu({ babyId }: AppDrawerMenuProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const items = useMemo<DrawerItem[]>(
    () => [
      {
        key: 'home',
        label: '首页',
        href: buildBabyScopedPath(babyId),
        exact: true,
        icon: House,
      },
      {
        key: 'records',
        label: '记录明细',
        href: buildBabyScopedPath(babyId, '/activities'),
        icon: ClipboardList,
      },
      {
        key: 'trends',
        label: '查看趋势',
        href: buildBabyScopedPath(babyId, '/daily-stats'),
        icon: TrendingUp,
      },
      {
        key: 'batch-import',
        label: '批量导入',
        href: buildBabyScopedPath(babyId, '/batch-import'),
        icon: FileUp,
      },
      {
        key: 'audits',
        label: '操作记录',
        href: buildBabyScopedPath(babyId, '/audits'),
        icon: History,
      },
      {
        key: 'babies',
        label: '宝宝管理',
        href: buildBabyScopedPath(babyId, '/babies'),
        icon: Baby,
      },
      {
        key: 'settings',
        label: '设置',
        href: buildBabyScopedPath(babyId, '/settings'),
        icon: Settings,
      },
    ],
    [babyId]
  )

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary"
          aria-label="打开导航菜单"
          data-testid="drawer-trigger"
        >
          <Menu size={18} />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="max-w-[320px]" data-testid="drawer-content">
        <SheetHeader className="border-b border-gray-100 px-5 py-4">
          <SheetTitle>导航菜单</SheetTitle>
          <SheetDescription className="text-xs text-gray-500">
            选择页面并保持当前宝宝上下文
          </SheetDescription>
        </SheetHeader>
        <nav className="flex flex-col gap-2 p-4">
          {items.map((item) => {
            const Icon = item.icon
            const active = isActive(pathname, item.href, item.exact)
            return (
              <SheetClose key={item.key} asChild>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                  }`}
                  data-testid={`drawer-link-${item.key}`}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </Link>
              </SheetClose>
            )
          })}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
