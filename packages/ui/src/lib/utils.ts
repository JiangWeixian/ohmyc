// Shared utility helpers for the UI package.
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Tailwind CSS class merger.
 * Accepts any number of class values (strings, objects, arrays), processes them
 * with clsx, then resolves conflicting Tailwind utilities via tailwind-merge.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
