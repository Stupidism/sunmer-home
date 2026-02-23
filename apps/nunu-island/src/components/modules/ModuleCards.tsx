'use client'

import Link from 'next/link'
import type { ModuleItem } from '@/lib/modules/catalog'

export function ModuleCards({ items }: { items: ModuleItem[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="rounded-2xl border border-gray-100 bg-white p-4 hover:border-rose-200 hover:bg-rose-50/50"
        >
          <h3 className="font-medium text-gray-900">{item.title}</h3>
          <p className="mt-1 text-sm text-gray-600">{item.desc}</p>
        </Link>
      ))}
    </div>
  )
}
