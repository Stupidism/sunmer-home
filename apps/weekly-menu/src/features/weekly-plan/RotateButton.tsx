'use client'

import { RefreshCw } from 'lucide-react'
import { Button } from '@bubu-log/ui/button'
import { cn } from '@bubu-log/ui/lib/utils'
import { useState } from 'react'

type RotateButtonProps = {
  onClick: () => void
  disabled?: boolean
}

export function RotateButton({
  onClick,
  disabled,
}: RotateButtonProps) {
  const [spinning, setSpinning] = useState(false)

  const handleClick = () => {
    setSpinning(true)
    setTimeout(() => setSpinning(false), 300)
    onClick()
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        'h-7 w-7 shrink-0 active:scale-95 active:opacity-80',
        spinning && 'animate-[spin_0.3s_ease-out]',
      )}
      onClick={handleClick}
      disabled={disabled}
      aria-label="随机换菜"
    >
      <RefreshCw className="h-3.5 w-3.5" />
    </Button>
  )
}
