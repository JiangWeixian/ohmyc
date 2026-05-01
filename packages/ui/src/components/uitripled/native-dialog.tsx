'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

// Use Radix UI Dialog consistently — the animated overlay and content
// require Radix Dialog.Root context. base-ui Dialog cannot provide it.

const NativeDialog = DialogPrimitive.Root

const NativeDialogTrigger = DialogPrimitive.Trigger

const NativeDialogPortal = DialogPrimitive.Portal

const NativeDialogClose = DialogPrimitive.Close

const NativeDialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...properties }, reference) => (
  <DialogPrimitive.Overlay ref={reference} asChild {...properties}>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        'fixed inset-0 z-50 bg-black/20 backdrop-blur-sm',
        className,
      )}
    />
  </DialogPrimitive.Overlay>
))
NativeDialogOverlay.displayName = 'NativeDialogOverlay'

const NativeDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...properties }, reference) => (
  <NativeDialogPortal>
    <NativeDialogOverlay />
    <DialogPrimitive.Content ref={reference} asChild {...properties}>
      <div className="fixed left-[50%] top-[50%] z-50 -translate-x-1/2 -translate-y-1/2">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
        transition={{ type: 'spring', duration: 0.5, bounce: 0 }}
        className={cn(
          'grid w-full max-w-lg gap-4 border border-white/10 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl p-6 shadow-2xl sm:rounded-2xl',
          className,
        )}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-full p-1 opacity-70 ring-offset-background transition-all hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </motion.div>
      </div>
    </DialogPrimitive.Content>
  </NativeDialogPortal>
))
NativeDialogContent.displayName = 'NativeDialogContent'

const NativeDialogHeader = ({
  className,
  ...properties
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-slot="dialog-header"
    className={cn('flex flex-col gap-2', className)}
    {...properties}
  />
)
NativeDialogHeader.displayName = 'NativeDialogHeader'

const NativeDialogFooter = ({
  className,
  ...properties
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-slot="dialog-footer"
    className={cn(
      'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
      className,
    )}
    {...properties}
  />
)
NativeDialogFooter.displayName = 'NativeDialogFooter'

const NativeDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...properties }, reference) => (
  <DialogPrimitive.Title
    ref={reference}
    className={cn('text-base leading-none font-medium', className)}
    {...properties}
  />
))
NativeDialogTitle.displayName = 'NativeDialogTitle'

const NativeDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...properties }, reference) => (
  <DialogPrimitive.Description
    ref={reference}
    className={cn('text-sm text-muted-foreground', className)}
    {...properties}
  />
))
NativeDialogDescription.displayName = 'NativeDialogDescription'

export {
  NativeDialog,
  NativeDialogClose,
  NativeDialogContent,
  NativeDialogDescription,
  NativeDialogFooter,
  NativeDialogHeader,
  NativeDialogOverlay,
  NativeDialogPortal,
  NativeDialogTitle,
  NativeDialogTrigger,
}
