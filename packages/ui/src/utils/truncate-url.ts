// Truncate a URL or long string for display.
// If the string is longer than maxLen, shows first 20 chars + '...' + last 15 chars.
export function truncateUrl(url: string, maxLength = 40): string {
  if (url.length <= maxLength) {
    return url
  }
  return `${url.slice(0, 20)}...${url.slice(-15)}`
}
