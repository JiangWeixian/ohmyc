import { readFileSync } from 'node:fs'
import path from 'node:path'

import {
  describe,
  expect,
  it,
} from 'vitest'

function readUiFile(filePath: string): string {
  return readFileSync(path.resolve(process.cwd(), filePath), 'utf8')
}

describe('Storybook public surface', () => {
  it('keeps Button as the canonical button story', () => {
    expect(() => readUiFile('src/stories/design-system/Button.stories.tsx')).not.toThrow()
    expect(() => readUiFile('src/stories/design-system/NativeButton.stories.tsx')).toThrow(/ENOENT/)
  })

  it('documents Menubar through composed and reusable surfaces only', () => {
    expect(() => readUiFile('src/stories/menubar/MenubarPage.stories.tsx')).not.toThrow()
    expect(() => readUiFile('src/stories/menubar/ViewSwitch.stories.tsx')).not.toThrow()
    expect(() => readUiFile('src/stories/menubar/RecentHeatmap.stories.tsx')).toThrow(/ENOENT/)
    expect(() => readUiFile('src/stories/menubar/DualLineChart.stories.tsx')).toThrow(/ENOENT/)
  })
})
