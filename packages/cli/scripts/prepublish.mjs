import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(__dirname, '..', 'package.json');

// Pre-flight checks
if (!existsSync(join(__dirname, '..', 'dist', 'index.cjs'))) {
  console.error('dist/index.cjs not found. Run pnpm build:full first.');
  process.exit(1);
}
if (!existsSync(join(__dirname, '..', 'dist', 'ui', 'index.html'))) {
  console.error('UI assets not found. Run pnpm build:full first.');
  process.exit(1);
}

// Read original and save backup
const original = readFileSync(pkgPath, 'utf-8');
const pkg = JSON.parse(original);

// Restore original on any exit
const restore = () => writeFileSync(pkgPath, original);
process.on('exit', restore);
process.on('SIGINT', () => { restore(); process.exit(130); });
process.on('SIGTERM', () => { restore(); process.exit(143); });

// Modify for publishing
pkg.name = '@aiou/cu';
pkg.dependencies = {};

// Write modified version (npm reads this during publish)
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('Package configured for publication as @aiou/cu');
console.log('Original package.json will be restored after publish completes.');
