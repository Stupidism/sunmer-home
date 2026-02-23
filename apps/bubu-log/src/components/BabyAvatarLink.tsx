'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Baby, Loader2, Settings } from 'lucide-react'
import { useBabyProfile } from '@/lib/api/hooks'

export function BabyAvatarLink() {
  const { data: profile, isLoading } = useBabyProfile()
  const avatar = profile?.avatarUrl ?? null

  return (
    <Link
      href="/settings"
      className="relative inline-flex items-center justify-center w-16 h-16 rounded-full border-3 border-white shadow-lg overflow-hidden bg-gradient-to-br from-pink-100 to-purple-100 dark:from-pink-900/30 dark:to-purple-900/30"
      aria-label="打开设置"
      title="设置"
    >
      {isLoading ? (
        <Loader2 size={24} className="text-primary animate-spin" />
      ) : avatar ? (
        <Image
          src={avatar}
          alt="宝宝头像"
          width={64}
          height={64}
          className="w-full h-full object-cover"
          unoptimized
        />
      ) : (
        <Baby size={24} className="text-primary" />
      )}

      <span className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center shadow-md">
        <Settings size={13} />
      </span>
    </Link>
  )
}
