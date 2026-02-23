'use client'

import { useMemo } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@bubu-log/ui/dropdown-menu'
import { Baby, Check, ChevronDown, Loader2 } from 'lucide-react'
import { replaceBabyIdInPathname } from '@/lib/baby-scope'

export type BabySwitcherItem = {
  id: string
  name: string
  fullName?: string | null
  avatarUrl: string | null
  isDefault: boolean
}

interface BabySwitcherProps {
  babies: BabySwitcherItem[]
  currentBabyId: string
  isLoading?: boolean
}

function AvatarContent({
  avatarUrl,
  isLoading,
}: {
  avatarUrl: string | null
  isLoading: boolean
}) {
  if (isLoading) {
    return <Loader2 size={18} className="animate-spin text-primary" />
  }

  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt="宝宝头像"
        width={36}
        height={36}
        className="w-full h-full object-cover"
        unoptimized
      />
    )
  }

  return <Baby size={18} className="text-primary" />
}

export function BabySwitcher({ babies, currentBabyId, isLoading = false }: BabySwitcherProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentBaby = useMemo(
    () => babies.find((item) => item.id === currentBabyId) ?? babies[0] ?? null,
    [babies, currentBabyId]
  )

  const disabled = isLoading || babies.length === 0
  const showDropdown = babies.length > 1
  const currentLabel = currentBaby?.name || currentBaby?.fullName || '宝宝'

  const handleSwitch = (targetBabyId: string) => {
    if (!targetBabyId || targetBabyId === currentBabyId) {
      return
    }

    const nextPath = replaceBabyIdInPathname(pathname, targetBabyId)
    const queryString = searchParams.toString()
    window.location.replace(queryString ? `${nextPath}?${queryString}` : nextPath)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled || !showDropdown}>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border border-white/80 bg-white/90 px-1.5 py-1.5 shadow-sm"
          data-testid="baby-switcher-trigger"
          aria-label={currentLabel ? `切换宝宝，当前：${currentLabel}` : '切换宝宝'}
        >
          <span className="relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white bg-gradient-to-br from-pink-100 to-orange-100">
            <AvatarContent avatarUrl={currentBaby?.avatarUrl ?? null} isLoading={isLoading} />
          </span>
          {showDropdown && <ChevronDown size={16} className="text-gray-500" />}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>切换宝宝</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {babies.map((baby) => {
          const babyLabel = baby.name || baby.fullName || '宝宝'
          return (
            <DropdownMenuItem
              key={baby.id}
              onClick={() => handleSwitch(baby.id)}
              className="flex items-center justify-between gap-3"
              data-testid={`baby-switcher-item-${baby.id}`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-pink-100 to-orange-100">
                  {baby.avatarUrl ? (
                    <Image
                      src={baby.avatarUrl}
                      alt={babyLabel}
                      width={32}
                      height={32}
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <Baby size={14} className="text-primary" />
                  )}
                </span>
                <span className="truncate text-sm">
                  {babyLabel}
                  {baby.isDefault ? '（默认）' : ''}
                </span>
              </span>
              {baby.id === currentBabyId && <Check size={14} className="text-primary" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
