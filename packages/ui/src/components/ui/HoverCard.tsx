import React from 'react';
import { motion, useMotionValue } from 'framer-motion';
import { cn } from '@/lib/utils';

interface HoverCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

/**
 * A card with a smooth hover effect and animations.
 * Perfect for interactive elements like cards, buttons, or items.
 */
export function HoverCard({
  children,
  className,
  onClick,
}: HoverCardProps) {
  const x = useMotionValue(0);
  const scale = useMotionValue(1);

  return (
    <motion.div
      onClick={onClick}
      whileHover={{ scale: 1.01, y: -2 }}
      whileTap={{ scale: 0.98 }}
      style={{ x, cursor: onClick ? 'pointer' : 'default' }}
      className={cn(
        'transition-shadow duration-150',
        'hover:shadow-[var(--shadow-md)]',
        className
      )}
    >
      {children}
    </motion.div>
  );
}
