import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export function getBanner(): string {
  // Read version from package.json
  const packagePath = path.resolve(__dirname, '../package.json')
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
  const version = packageJson.version

  return [
    '   ___   _   _   __  __     ____',
    String.raw`  / _ \ | | | |  \ \/ /    / ___|`,
    String.raw` | | | || |_| |   \  /    | |    `,
    String.raw` | |_| ||  _  |   /  \    | |___ `,
    String.raw`  \___/ |_| |_|  /_/\_\    \____|`,
    '',
    `OhMyC v${version} — CLI for managing .claude configs`,
  ].join('\n')
}

export function printBanner(): void {
  if (process.stdout.isTTY) {
    console.log(getBanner())
  }
}
