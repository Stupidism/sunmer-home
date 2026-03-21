'use client'

import * as React from 'react'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@bubu-log/ui'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

export function BottomSheet({ isOpen, onClose, title, children }: BottomSheetProps) {
  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-w-lg mx-auto" data-testid="bottom-sheet">
        {title && (
          <DrawerHeader className="border-b border-gray-100 dark:border-gray-800">
            <DrawerTitle className="text-xl font-bold text-center">
              {title}
            </DrawerTitle>
          </DrawerHeader>
        )}
        <div 
          className="px-6 pt-4 pb-32 overflow-y-auto no-scrollbar" 
          style={{ maxHeight: 'calc(80vh - 80px)' }}
        >
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
