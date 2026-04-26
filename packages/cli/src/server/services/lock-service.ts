import { writeFile } from 'node:fs/promises'
import path from 'node:path'

import lockfile from 'proper-lockfile'

export class LockService {
  private lockPath: string
  private releaseHandle: (() => Promise<void>) | null = null

  constructor(lockDir: string) {
    this.lockPath = path.join(lockDir, '.activation.lock')
  }

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

  async release(): Promise<void> {
    if (this.releaseHandle) {
      await this.releaseHandle()
      this.releaseHandle = null
    }
  }
}
