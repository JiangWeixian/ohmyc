import yaml from 'js-yaml'

/** Regex matching a YAML frontmatter fence (`---`). */
const FENCE = /^---\s*$/m

/** Result of successfully parsing a markdown document with frontmatter. */
export interface ParsedMarkdown {
  frontmatter: Record<string, unknown>
  content: string
}

/** Successful parse result with extracted frontmatter and body. */
export interface MarkdownParseResult {
  ok: true
  frontmatter: Record<string, unknown>
  content: string
}

/** Failed parse result with an error message and optional line number. */
export interface MarkdownParseError {
  ok: false
  message: string
  line?: number
}

/**
 * Parses a markdown document, extracting YAML frontmatter between `---` fences.
 * Returns an error result when frontmatter is unclosed, invalid YAML, or not an object.
 * @param raw - The raw markdown text to parse.
 * @returns Either a successful parse result or an error descriptor.
 */
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

/**
 * Serializes frontmatter and content back into a markdown document.
 * Strips undefined and empty-string values from frontmatter before serializing.
 * @param frontmatter - Key-value pairs to embed as YAML frontmatter.
 * @param content - Markdown body content.
 * @returns The combined markdown document with `---` fences.
 */
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
