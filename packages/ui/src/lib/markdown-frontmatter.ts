import yaml from 'js-yaml'

const FENCE = /^---\s*$/m

export interface ParsedMarkdown {
  frontmatter: Record<string, unknown>
  content: string
}

export interface MarkdownParseResult {
  ok: true
  frontmatter: Record<string, unknown>
  content: string
}

export interface MarkdownParseError {
  ok: false
  message: string
  line?: number
}

export function parseMarkdownDocument(raw: string): MarkdownParseError | MarkdownParseResult {
  if (!raw.trimStart().startsWith('---')) {
    // No frontmatter — whole buffer is body
    return { ok: true, frontmatter: {}, content: raw }
  }

  const lines = raw.split('\n')
  // First non-empty line should be ---
  let openIndex = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '') {
      continue
    }
    if (FENCE.test(lines[i])) {
      openIndex = i
    }
    break
  }
  if (openIndex === -1) {
    return { ok: true, frontmatter: {}, content: raw }
  }

  let closeIndex = -1
  for (let i = openIndex + 1; i < lines.length; i++) {
    if (FENCE.test(lines[i])) {
      closeIndex = i
      break
    }
  }
  if (closeIndex === -1) {
    return { ok: false, message: 'frontmatter not closed — missing trailing ---', line: openIndex + 1 }
  }

  const yamlBody = lines.slice(openIndex + 1, closeIndex).join('\n')
  let parsed: unknown
  try {
    parsed = yaml.load(yamlBody)
  } catch (error: unknown) {
    const error_ = error as { message?: string, mark?: { line?: number } }
    const errorLine = error_.mark?.line != null ? openIndex + 1 + error_.mark.line + 1 : openIndex + 1
    return {
      ok: false,
      message: error_.message?.split('\n')[0] || 'invalid YAML in frontmatter',
      line: errorLine,
    }
  }

  if (parsed != null && typeof parsed !== 'object') {
    return { ok: false, message: 'frontmatter must be a YAML mapping', line: openIndex + 1 }
  }

  const content = lines.slice(closeIndex + 1).join('\n').replace(/^\n/, '')
  return { ok: true, frontmatter: (parsed as Record<string, unknown>) ?? {}, content }
}

export function stringifyMarkdownDocument(frontmatter: Record<string, unknown>, content: string): string {
  const cleaned = Object.fromEntries(
    Object.entries(frontmatter).filter(([, v]) => v !== undefined && v !== ''),
  )
  if (Object.keys(cleaned).length === 0) {
    return content
  }
  const yamlText = yaml.dump(cleaned, { lineWidth: 1000, noRefs: true }).trimEnd()
  return `---\n${yamlText}\n---\n\n${content}`
}
