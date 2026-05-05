// Lightweight class-name joiner for settings sub-components.
// Filters falsy values so conditional classes can be passed without ternaries.

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
