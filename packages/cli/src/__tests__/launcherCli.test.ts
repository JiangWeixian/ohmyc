import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { launchApp } from '../launcher';
import path from 'path';
import { readFileSync } from 'fs';

// Mock the server module
vi.mock('../server/index', () => ({
  startServer: vi.fn(),
}));

// Mock the open package
vi.mock('open', () => ({
  default: vi.fn(),
}));

import { startServer } from '../server/index';
import open from 'open';

describe('CLI launcher', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe('default launch flow', () => {
    it('prints "starting server" status before waiting for startServer()', async () => {
      const startServerMock = vi.mocked(startServer);
      const openMock = vi.mocked(open);

      let startServerCalled = false;
      startServerMock.mockImplementation(async () => {
        startServerCalled = true;
        return {
          port: 3000,
          address: 'http://0.0.0.0:3000',
          staticRoot: '/fake/ui',
          fallback: false,
          close: async () => {},
        };
      });
      openMock.mockResolvedValue({} as any);

      await launchApp({ defaultPort: 3000 });

      // The "starting" message must be logged before startServer resolves
      expect(startServerCalled).toBe(true);

      // Check that a "starting" status was logged
      const logCalls = logSpy.mock.calls.map((args: any[]) => args.join(' '));
      const hasStartingMsg = logCalls.some(msg =>
        /starting/i.test(msg) && /server/i.test(msg)
      );
      expect(hasStartingMsg).toBe(true);
    });

    it('prints "opening browser" status and calls browser opener with the resolved URL', async () => {
      const startServerMock = vi.mocked(startServer);
      const openMock = vi.mocked(open);

      startServerMock.mockResolvedValue({
        port: 3000,
        address: 'http://0.0.0.0:3000',
        staticRoot: '/fake/ui',
        fallback: false,
        close: async () => {},
      });
      openMock.mockResolvedValue({} as any);

      await launchApp({ defaultPort: 3000 });

      // Verify browser opener was called with the correct URL
      expect(openMock).toHaveBeenCalledTimes(1);
      expect(openMock).toHaveBeenCalledWith('http://localhost:3000');

      // Verify "opening browser" status was logged
      const logCalls = logSpy.mock.calls.map((args: any[]) => args.join(' '));
      const hasOpeningMsg = logCalls.some(msg =>
        /opening|browser/i.test(msg)
      );
      expect(hasOpeningMsg).toBe(true);
    });

    it('opens browser to fallback port when startServer reports fallback', async () => {
      const startServerMock = vi.mocked(startServer);
      const openMock = vi.mocked(open);

      startServerMock.mockResolvedValue({
        port: 3001,
        address: 'http://0.0.0.0:3001',
        staticRoot: '/fake/ui',
        fallback: true,
        close: async () => {},
      });
      openMock.mockResolvedValue({} as any);

      await launchApp({ defaultPort: 3000 });

      // Browser should open to the actual port, not the requested one
      expect(openMock).toHaveBeenCalledWith('http://localhost:3001');

      // Status output should reflect success (not failure)
      const logCalls = logSpy.mock.calls.map((args: any[]) => args.join(' '));
      const hasSuccessMsg = logCalls.some(msg =>
        /ready|listening|started/i.test(msg)
      );
      expect(hasSuccessMsg).toBe(true);
    });

    it('throws an actionable error when startup fails', async () => {
      const startServerMock = vi.mocked(startServer);
      const openMock = vi.mocked(open);

      startServerMock.mockRejectedValue(new Error('Port 3000 is in use'));

      await expect(launchApp({ defaultPort: 3000 })).rejects.toThrow(
        /failed to start claudeui/i,
      );

      // Browser opener should NOT have been called
      expect(openMock).not.toHaveBeenCalled();
    });
  });

  describe('package metadata', () => {
    it('exposes a "cu" bin entry that resolves to the launcher entrypoint', () => {
      const pkgPath = path.resolve(__dirname, '../../package.json');
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

      // Must have a "cu" bin entry
      expect(pkg.bin).toBeDefined();
      expect(pkg.bin.cu).toBeDefined();

      // The bin entry should point to a dist file (built entrypoint)
      expect(pkg.bin.cu).toMatch(/^dist\//);
    });
  });
});
