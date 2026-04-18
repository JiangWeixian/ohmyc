import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import path from 'path';
import os from 'os';
import { LockService } from '../lockService';

describe('LockService', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'lock-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('acquiring and releasing works', async () => {
    const lock = new LockService(tmpDir);
    await lock.acquire();
    // If we get here, acquire succeeded
    await lock.release();
  });

  it('second acquire on same path fails while first is held', async () => {
    const lock1 = new LockService(tmpDir);
    const lock2 = new LockService(tmpDir);

    await lock1.acquire();
    await expect(lock2.acquire()).rejects.toThrow('Another activation is in progress');
    await lock1.release();
  });

  it('releasing allows re-acquiring', async () => {
    const lock = new LockService(tmpDir);

    await lock.acquire();
    await lock.release();

    // Should succeed after release
    await lock.acquire();
    await lock.release();
  });

  it('release when no lock held does not throw', async () => {
    const lock = new LockService(tmpDir);
    await expect(lock.release()).resolves.not.toThrow();
  });

  it('double release does not throw', async () => {
    const lock = new LockService(tmpDir);
    await lock.acquire();
    await lock.release();
    await expect(lock.release()).resolves.not.toThrow();
  });
});
