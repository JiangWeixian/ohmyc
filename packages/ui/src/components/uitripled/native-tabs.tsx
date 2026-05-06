// Animated tabs with a shared-layout spring indicator and crossfade content transitions.
// Uses framer-motion layoutId so the active-tab highlight slides smoothly between triggers.

'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

/** Data-driven tabs component with spring-animated active indicator. */
interface NativeTabsProperties {
  items: {
    id: string
    label: string
    content: React.ReactNode
  }[]
  defaultValue?: string
  className?: string
}

/** Renders a data-driven tab group with animated indicator and content transitions. */
export function NativeTabs({
  items,
  defaultValue,
  className,
}: NativeTabsProperties) {
  const [activeTab, setActiveTab] = useState(defaultValue || items[0].id)

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className={cn('w-full max-w-md', className)}
    >
      <TabsList className="relative flex w-full items-center gap-1 rounded-xl bg-muted/50 p-1 border border-black/5 dark:border-white/5">
        {items.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="relative z-10 flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              {/* Shared layoutId lets framer-motion animate the background pill
                  between triggers as a single shared element instead of remounting. */}
              {isActive && (
                <motion.div
                  layoutId="active-tab"
                  className="absolute inset-0 z-[-1] rounded-lg bg-background shadow-sm border border-black/5 dark:border-white/5"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
              {tab.label}
            </TabsTrigger>
          )
        })}
      </TabsList>
      {items.map(item => (
        <TabsContent
          key={item.id}
          value={item.id}
          className="mt-4 overflow-hidden rounded-xl border bg-background p-6 shadow-sm"
        >
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
          >
            {item.content}
          </motion.div>
        </TabsContent>
      ))}
    </Tabs>
  )
}
