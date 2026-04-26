import {
  existsSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packagePath = path.join(import.meta.dirname, '..', 'package.json')

// Pre-flight checks
if (!existsSync(path.join(import.meta.dirname, '..', 'dist', 'index.mjs'))) {
  console.error('dist/index.mjs not found. Run pnpm build:full first.')
  throw new Error('dist/index.mjs not found')
}
if (!existsSync(path.join(import.meta.dirname, '..', 'dist', 'ui', 'index.html'))) {
  console.error('UI assets not found. Run pnpm build:full first.')
  throw new Error('UI assets not found')
}

// Read original and save backup
const original = readFileSync(packagePath, 'utf8')
const package_ = JSON.parse(original)

// Restore original on any exit
const restore = () => writeFileSync(packagePath, original)
process.on('exit', restore)
process.on('SIGINT', () => {
  restore()
  process.exit(130)
})
process.on('SIGTERM', () => {
  restore()
  process.exit(143)
})

// Modify for publishing
package_.name = '@aiou/cu'
package_.dependencies = {}

// Write modified version (npm reads this during publish)
writeFileSync(packagePath, `${JSON.stringify(package_, null, 2)}\n`)
console.log('Package configured for publication as @aiou/cu')
console.log('Original package.json will be restored after publish completes.')
