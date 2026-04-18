import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';
import os from 'os';
import { ModelConfigService } from '../modelConfigService';

describe('ModelConfigService', () => {
  let tmpDir: string;
  let service: ModelConfigService;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'mc-test-'));
    service = new ModelConfigService(tmpDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('create()', () => {
    it('creates config with required fields and defaults for optional', async () => {
      const config = await service.create({ name: 'test', apiKey: 'key123', baseUrl: 'http://localhost:11434' });

      expect(config).toEqual({
        name: 'test',
        apiKey: 'key123',
        baseUrl: 'http://localhost:11434',
        modelName: '',
        provider: '',
      });

      const onDisk = JSON.parse(readFileSync(path.join(tmpDir, 'test.json'), 'utf-8'));
      expect(onDisk).toEqual(config);
    });

    it('creates config with all fields specified', async () => {
      const config = await service.create({
        name: 'claude-pro',
        apiKey: 'sk-xxx',
        baseUrl: 'https://api.anthropic.com',
        modelName: 'claude-3-opus',
        provider: 'anthropic',
      });

      expect(config).toEqual({
        name: 'claude-pro',
        apiKey: 'sk-xxx',
        baseUrl: 'https://api.anthropic.com',
        modelName: 'claude-3-opus',
        provider: 'anthropic',
      });
    });

    it('rejects duplicate name', async () => {
      await service.create({ name: 'existing', apiKey: 'key', baseUrl: 'http://x' });

      await expect(
        service.create({ name: 'existing', apiKey: 'other', baseUrl: 'http://y' }),
      ).rejects.toThrow('already exists');
    });

    it('rejects invalid name', async () => {
      await expect(
        service.create({ name: 'bad name!', apiKey: 'key', baseUrl: 'http://x' }),
      ).rejects.toThrow('invalid');
    });
  });

  describe('get()', () => {
    it('returns existing config', async () => {
      await service.create({ name: 'my-model', apiKey: 'k', baseUrl: 'http://x' });

      const config = await service.get('my-model');
      expect(config).not.toBeNull();
      expect(config!.name).toBe('my-model');
      expect(config!.apiKey).toBe('k');
      expect(config!.baseUrl).toBe('http://x');
    });

    it('returns null for nonexistent', async () => {
      const config = await service.get('nope');
      expect(config).toBeNull();
    });

    it('returns null for invalid name', async () => {
      const config = await service.get('bad!name');
      expect(config).toBeNull();
    });
  });

  describe('list()', () => {
    it('returns all configs sorted by filename', async () => {
      await service.create({ name: 'bravo', apiKey: 'b', baseUrl: 'http://b' });
      await service.create({ name: 'alpha', apiKey: 'a', baseUrl: 'http://a' });
      await service.create({ name: 'charlie', apiKey: 'c', baseUrl: 'http://c' });

      const configs = await service.list();
      expect(configs.map(c => c.name)).toEqual(['alpha', 'bravo', 'charlie']);
    });

    it('returns empty array when directory does not exist', async () => {
      const noDir = path.join(tmpDir, 'nonexistent');
      const svc = new ModelConfigService(noDir);
      const configs = await svc.list();
      expect(configs).toEqual([]);
    });

    it('skips files that fail to parse', async () => {
      await service.create({ name: 'valid', apiKey: 'k', baseUrl: 'http://x' });
      writeFileSync(path.join(tmpDir, 'broken.json'), 'not valid json{');

      const configs = await service.list();
      expect(configs).toHaveLength(1);
      expect(configs[0].name).toBe('valid');
    });
  });

  describe('update()', () => {
    it('merges changes and preserves other fields', async () => {
      await service.create({
        name: 'update-me',
        apiKey: 'old-key',
        baseUrl: 'http://old',
        modelName: 'old-model',
        provider: 'old-provider',
      });

      const updated = await service.update('update-me', { apiKey: 'new-key' });

      expect(updated).not.toBeNull();
      expect(updated!.apiKey).toBe('new-key');
      expect(updated!.baseUrl).toBe('http://old');
      expect(updated!.modelName).toBe('old-model');
      expect(updated!.provider).toBe('old-provider');
    });

    it('preserves the file on disk', async () => {
      await service.create({ name: 'persist', apiKey: 'k', baseUrl: 'http://x' });
      await service.update('persist', { baseUrl: 'http://updated' });

      const onDisk = JSON.parse(readFileSync(path.join(tmpDir, 'persist.json'), 'utf-8'));
      expect(onDisk.baseUrl).toBe('http://updated');
      expect(onDisk.apiKey).toBe('k');
    });

    it('returns null for nonexistent config', async () => {
      const result = await service.update('nonexistent', { apiKey: 'x' });
      expect(result).toBeNull();
    });
  });

  describe('delete()', () => {
    it('removes the file and returns true', async () => {
      await service.create({ name: 'deleteme', apiKey: 'k', baseUrl: 'http://x' });

      const result = await service.delete('deleteme');
      expect(result).toBe(true);

      const config = await service.get('deleteme');
      expect(config).toBeNull();
    });

    it('returns false for nonexistent', async () => {
      const result = await service.delete('nope');
      expect(result).toBe(false);
    });

    it('returns false for invalid name', async () => {
      const result = await service.delete('bad!name');
      expect(result).toBe(false);
    });
  });
});
