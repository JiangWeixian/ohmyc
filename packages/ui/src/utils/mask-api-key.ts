// Mask an API key by showing only the last 4 characters with a fixed 4-asterisk prefix.
// Does NOT reveal key length.
export function maskApiKey(key: string): string {
  if (key.length >= 4) {
    return `****${key.slice(-4)}`
  }
  return '****'
}

/**
 * Detects whether a value is the masked sentinel (starts with ****).
 * Used to determine if the user changed the API key field in the edit form.
 */
export function isMaskedValue(value: string): boolean {
  return value.startsWith('****')
}
