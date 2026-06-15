import {
  existsSync,
  mkdtempSync,
  rmSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest'

import {
  copyTimelinePluginAssets,
  resolveTimelinePluginPackageDir,
  timelinePluginCopyPaths,
} from '../tsup.config'

describe('CLI timeline plugin build assets', () => {
  let tmpDir: string | undefined

  afterEach(() => {
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('copies package plugin manifests and runtime files into dist', () => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'ohmyc-cli-assets-'))
    const outputDir = path.join(tmpDir, 'plugins', 'timeline')

    copyTimelinePluginAssets({ outputDir })

    expect(existsSync(path.join(outputDir, '.agents/plugins/marketplace.json'))).toBe(true)
    expect(existsSync(path.join(outputDir, '.claude-plugin/plugin.json'))).toBe(true)
    expect(existsSync(path.join(outputDir, '.codex-plugin/plugin.json'))).toBe(true)
    expect(existsSync(path.join(outputDir, 'hooks/hooks.json'))).toBe(true)
    expect(existsSync(path.join(outputDir, 'dist/ingest.mjs'))).toBe(true)
    expect(existsSync(path.join(outputDir, 'package.json'))).toBe(true)
    expect(existsSync(path.join(outputDir, '.agents/skills'))).toBe(false)
  })

  it('does not copy the removed monorepo plugin source tree', () => {
    expect(resolveTimelinePluginPackageDir()).toContain(`${path.sep}node_modules${path.sep}@ohmyc${path.sep}timeline-plugin`)
    expect(timelinePluginCopyPaths).toEqual([
      '.agents/plugins',
      '.claude-plugin',
      '.codex-plugin',
      'dist',
      'hooks',
      'package.json',
      'README.md',
    ])
  })
})
