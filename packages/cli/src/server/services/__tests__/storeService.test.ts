import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import path from 'path';
import os from 'os';
import { StoreService } from '../storeService';

describe('StoreService', () => {
  let tmpDir: string;
  let storeDir: string;
  let profilesDir: string;
  let service: StoreService;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'store-test-'));
    storeDir = path.join(tmpDir, 'store');
    profilesDir = path.join(tmpDir, 'profiles');
    service = new StoreService(storeDir, profilesDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('import()', () => {
    it('imports agents, skills, commands from source', async () => {
      const src = path.join(tmpDir, 'source');
      mkdirSync(path.join(src, 'agents'), { recursive: true });
      writeFileSync(path.join(src, 'agents', 'a.md'), 'agent');
      mkdirSync(path.join(src, 'skills', 'sk'), { recursive: true });
      writeFileSync(path.join(src, 'skills', 'sk', 'SKILL.md'), 'skill');
      mkdirSync(path.join(src, 'commands'), { recursive: true });
      writeFileSync(path.join(src, 'commands', 'c.md'), 'command');

      const result = await service.import({ sourceDir: src });
      expect(result.imported).toBe(3);
      expect(result.skipped).toBe(0);
      expect(result.overwritten).toBe(0);
      expect(existsSync(path.join(storeDir, 'agents', 'a.md'))).toBe(true);
      expect(existsSync(path.join(storeDir, 'skills', 'sk', 'SKILL.md'))).toBe(true);
      expect(existsSync(path.join(storeDir, 'commands', 'c.md'))).toBe(true);
    });

    it('reports dry-run conflicts without copying files', async () => {
      mkdirSync(path.join(storeDir, 'agents'), { recursive: true });
      writeFileSync(path.join(storeDir, 'agents', 'a.md'), 'existing');

      const src = path.join(tmpDir, 'source');
      mkdirSync(path.join(src, 'agents'), { recursive: true });
      writeFileSync(path.join(src, 'agents', 'a.md'), 'new');

      const result = await service.import({ sourceDir: src, dryRun: true });
      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.overwritten).toBe(0);
      expect(result.conflicts).toEqual([
        {
          type: 'agents',
          id: 'a',
          sourcePath: path.join(src, 'agents', 'a.md'),
          destinationPath: path.join(storeDir, 'agents', 'a.md'),
        },
      ]);
      expect(readFileSync(path.join(storeDir, 'agents', 'a.md'), 'utf-8')).toBe('existing');
    });

    it('skips existing components when overwrite is disabled', async () => {
      mkdirSync(path.join(storeDir, 'agents'), { recursive: true });
      writeFileSync(path.join(storeDir, 'agents', 'a.md'), 'existing');

      const src = path.join(tmpDir, 'source');
      mkdirSync(path.join(src, 'agents'), { recursive: true });
      writeFileSync(path.join(src, 'agents', 'a.md'), 'new');

      const result = await service.import({ sourceDir: src });
      expect(result.skipped).toBe(1);
      expect(result.imported).toBe(0);
      expect(result.overwritten).toBe(0);
    });

    it('overwrites an existing agent when overwrite is enabled', async () => {
      mkdirSync(path.join(storeDir, 'agents'), { recursive: true });
      writeFileSync(path.join(storeDir, 'agents', 'reviewer.md'), 'old content');

      const src = path.join(tmpDir, 'source');
      mkdirSync(path.join(src, 'agents'), { recursive: true });
      writeFileSync(path.join(src, 'agents', 'reviewer.md'), 'new content');

      const result = await service.import({ sourceDir: src, overwrite: true });
      expect(result.overwritten).toBe(1);
      expect(result.imported).toBe(0);
      expect(readFileSync(path.join(storeDir, 'agents', 'reviewer.md'), 'utf-8')).toBe('new content');
    });

    it('copies nested skill assets', async () => {
      const src = path.join(tmpDir, 'source');
      mkdirSync(path.join(src, 'skills', 'designer', 'assets', 'icons'), { recursive: true });
      writeFileSync(path.join(src, 'skills', 'designer', 'SKILL.md'), 'skill');
      writeFileSync(path.join(src, 'skills', 'designer', 'assets', 'icons', 'logo.svg'), '<svg />');

      const result = await service.import({ sourceDir: src });
      expect(result.imported).toBe(1);
      expect(
        existsSync(path.join(storeDir, 'skills', 'designer', 'assets', 'icons', 'logo.svg'))
      ).toBe(true);
    });

    it('persists provenance with importPath and importedAt strings', async () => {
      const src = path.join(tmpDir, 'source');
      mkdirSync(path.join(src, 'agents'), { recursive: true });
      writeFileSync(path.join(src, 'agents', 'reviewer.md'), 'agent');

      await service.import({ sourceDir: src });

      const importsIndex = JSON.parse(
        readFileSync(path.join(storeDir, '.metadata', 'imports.json'), 'utf-8')
      );

      expect(importsIndex.agents.reviewer.importPath).toBe(path.join(src, 'agents', 'reviewer.md'));
      expect(typeof importsIndex.agents.reviewer.importedAt).toBe('string');
      expect(Number.isNaN(Date.parse(importsIndex.agents.reviewer.importedAt))).toBe(false);
    });
  });

  describe('getReferencingProfiles()', () => {
    it('returns profiles referencing a component', async () => {
      mkdirSync(path.join(profilesDir, 'prof-a'), { recursive: true });
      writeFileSync(path.join(profilesDir, 'prof-a', 'profile.json'), JSON.stringify({
        name: 'prof-a', agents: ['reviewer'], skills: [], commands: [],
      }));
      mkdirSync(path.join(profilesDir, 'prof-b'), { recursive: true });
      writeFileSync(path.join(profilesDir, 'prof-b', 'profile.json'), JSON.stringify({
        name: 'prof-b', agents: [], skills: [], commands: [],
      }));

      const refs = await service.getReferencingProfiles('agents', 'reviewer');
      expect(refs).toEqual(['prof-a']);
    });

    it('returns empty array when no references', async () => {
      const refs = await service.getReferencingProfiles('agents', 'nobody');
      expect(refs).toEqual([]);
    });
  });

  describe('getReferencingProfiles() for model-configs', () => {
    it('returns profiles referencing a model config', async () => {
      mkdirSync(path.join(profilesDir, 'prof-a'), { recursive: true });
      writeFileSync(path.join(profilesDir, 'prof-a', 'profile.json'), JSON.stringify({
        name: 'prof-a', agents: [], skills: [], commands: [], modelConfig: 'claude-pro',
      }));
      mkdirSync(path.join(profilesDir, 'prof-b'), { recursive: true });
      writeFileSync(path.join(profilesDir, 'prof-b', 'profile.json'), JSON.stringify({
        name: 'prof-b', agents: [], skills: [], commands: [],
      }));

      const refs = await service.getReferencingProfiles('model-configs', 'claude-pro');
      expect(refs).toEqual(['prof-a']);
    });

    it('returns empty array when no profiles reference the model config', async () => {
      const refs = await service.getReferencingProfiles('model-configs', 'nobody');
      expect(refs).toEqual([]);
    });

    it('returns multiple profiles referencing the same model config', async () => {
      mkdirSync(path.join(profilesDir, 'p1'), { recursive: true });
      writeFileSync(path.join(profilesDir, 'p1', 'profile.json'), JSON.stringify({
        name: 'p1', agents: [], skills: [], commands: [], modelConfig: 'shared',
      }));
      mkdirSync(path.join(profilesDir, 'p2'), { recursive: true });
      writeFileSync(path.join(profilesDir, 'p2', 'profile.json'), JSON.stringify({
        name: 'p2', agents: [], skills: [], commands: [], modelConfig: 'shared',
      }));

      const refs = await service.getReferencingProfiles('model-configs', 'shared');
      expect(refs.sort()).toEqual(['p1', 'p2']);
    });
  });
});
