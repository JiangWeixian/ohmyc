import { lstat, readFile, readlink } from 'fs/promises';
import path from 'path';

export async function resolveInventorySource(itemPath: string, baseDir?: string): Promise<'local' | 'profile'> {
  try {
    const stats = await lstat(itemPath);
    if (!stats.isSymbolicLink()) return 'local';

    const activeProfileDir = await readActiveProfileDir(baseDir);
    if (!activeProfileDir) return 'local';

    const immediateTargetPath = path.resolve(path.dirname(itemPath), await readlink(itemPath));
    return isWithinDir(immediateTargetPath, activeProfileDir) ? 'profile' : 'local';
  } catch {
    return 'local';
  }
}

async function readActiveProfileDir(baseDir?: string): Promise<string | null> {
  if (!baseDir) return null;
  try {
    const activePath = path.join(baseDir, 'profiles', '.active');
    return (await readFile(activePath, 'utf-8')).trim();
  } catch {
    return null;
  }
}

function isWithinDir(candidatePath: string, parentDir: string): boolean {
  const relativePath = path.relative(parentDir, candidatePath);
  return relativePath !== '' && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}
