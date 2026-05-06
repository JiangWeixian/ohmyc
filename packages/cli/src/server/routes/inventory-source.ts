// Determines whether an inventory item (agent, skill, command) originates from the active profile symlink or is local.
import {
  lstat,
  readFile,
  readlink,
} from 'node:fs/promises'
import path from 'node:path'

/**
 * Checks whether an item path is a symlink pointing into the active profile directory.
 * @param itemPath - Absolute path to the inventory item file or directory.
 * @param baseDir - OhMyC base directory (used to locate the active profile symlink).
 * @returns `'profile'` when the item is a symlink into the active profile, otherwise `'local'`.
 */
export async function resolveInventorySource(itemPath: string, baseDir?: string): Promise<'local' | 'profile'> {
  try {
    const stats = await lstat(itemPath)
    if (!stats.isSymbolicLink()) {
      return 'local'
    }

    const activeProfileDir = await readActiveProfileDir(baseDir)
    if (!activeProfileDir) {
      return 'local'
    }

    const immediateTargetPath = path.resolve(path.dirname(itemPath), await readlink(itemPath))
    return isWithinDir(immediateTargetPath, activeProfileDir) ? 'profile' : 'local'
  } catch {
    return 'local'
  }
}

/**
 * Reads the active profile path from the `.active` symlink under `profiles/`.
 * Returns null when the base directory is unknown or the symlink is missing.
 */
async function readActiveProfileDir(baseDir?: string): Promise<string | null> {
  if (!baseDir) {
    return null
  }
  try {
    const activePath = path.join(baseDir, 'profiles', '.active')
    const content = await readFile(activePath, 'utf8')
    return content.trim()
  } catch {
    return null
  }
}

/**
 * Checks whether `candidatePath` is inside `parentDir` without escaping it.
 * Uses path.relative to detect upward traversal (`..`) or exact match.
 */
function isWithinDir(candidatePath: string, parentDir: string): boolean {
  const relativePath = path.relative(parentDir, candidatePath)
  return relativePath !== '' && !relativePath.startsWith('..') && !path.isAbsolute(relativePath)
}
