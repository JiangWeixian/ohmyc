import { writeFile } from 'node:fs/promises'
import path from 'node:path'

import lockfile from 'proper-lockfile'

/**
 * Provides mutual exclusion for profile activation operations.
 * Uses a file-based lock to prevent concurrent activations from corrupting the profile symlink state.
 */
export class LockService {
  private lockPath: string
  private releaseHandle: (() => Promise<void>) | null = null

  constructor(lockDir: string) {
    this.lockPath = path.join(lockDir, '.activation.lock')
  }

  /**
   * Acquires the activation lock, creating the lock file if necessary.
   * Throws when the lock is already held by another process.
   */
  async acquire(): Promise<void> {
    // Ensure the lock file exists before locking
    try {
      await writeFile(this.lockPath, '', { flag: 'wx' })
    } catch {
      // File already exists, that's fine
    }

    try {
      this.releaseHandle = await lockfile.lock(this.lockPath, {
        stale: 10_000,
        retries: { retries: 3, minTimeout: 200 },
      })
    } catch {
      throw new Error('Another activation is in progress. Wait a moment and try again.')
    }
  }

  /** Releases the activation lock if currently held. */
  async release(): Promise<void> {
    if (this.releaseHandle) {
      await this.releaseHandle()
      this.releaseHandle = null
    }
  }
}
