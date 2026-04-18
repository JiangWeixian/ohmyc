import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'fs';
import path from 'path';
import os from 'os';
import { ConfigLocator, AGENT_DIR_NAME } from '../configLocator';

describe('ConfigLocator', () => {
  let tmpDir: string;
  let savedAgentHome: string | undefined;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'config-locator-test-'));
    // Save and clear AGENT_HOME to prevent env pollution between tests
    savedAgentHome = process.env.AGENT_HOME;
    delete process.env.AGENT_HOME;
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    // Restore AGENT_HOME
    if (savedAgentHome !== undefined) {
      process.env.AGENT_HOME = savedAgentHome;
    } else {
      delete process.env.AGENT_HOME;
    }
  });

  describe('project discovery', () => {
    it('discovers .claude/ when present in cwd', () => {
      mkdirSync(path.join(tmpDir, '.claude'));
      const locator = new ConfigLocator({ cwd: tmpDir });
      expect(locator.hasProject).toBe(true);
      expect(locator.projectPath).toBe(path.join(tmpDir, '.claude'));
    });

    it('returns null projectPath when .claude/ is absent', () => {
      const locator = new ConfigLocator({ cwd: tmpDir });
      expect(locator.hasProject).toBe(false);
      expect(locator.projectPath).toBeNull();
    });
  });

  describe('global path resolution', () => {
    it('resolves all global paths from homedir', () => {
      const locator = new ConfigLocator({ cwd: tmpDir });
      expect(locator.baseDir).toBe(path.join(os.homedir(), '.claude'));
      expect(locator.agentsDir).toBe(path.join(os.homedir(), '.claude', 'agents'));
      expect(locator.skillsDir).toBe(path.join(os.homedir(), '.claude', 'skills'));
      expect(locator.commandsDir).toBe(path.join(os.homedir(), '.claude', 'commands'));
      expect(locator.pluginsDir).toBe(path.join(os.homedir(), '.claude', 'plugins'));
      expect(locator.settingsPath).toBe(path.join(os.homedir(), '.claude', 'settings.json'));
    });
  });

  describe('AGENT_HOME env var', () => {
    it('respects AGENT_HOME env var for global dir', () => {
      process.env.AGENT_HOME = '.custom-claude';
      const locator = new ConfigLocator({ cwd: tmpDir });
      expect(locator.baseDir).toBe(path.join(os.homedir(), '.custom-claude'));
      expect(locator.agentsDir).toBe(path.join(os.homedir(), '.custom-claude', 'agents'));
    });

    it('respects AGENT_HOME env var for project discovery', () => {
      process.env.AGENT_HOME = '.custom-claude';
      mkdirSync(path.join(tmpDir, '.custom-claude'));
      const locator = new ConfigLocator({ cwd: tmpDir });
      expect(locator.hasProject).toBe(true);
      expect(locator.projectPath).toBe(path.join(tmpDir, '.custom-claude'));
    });
  });

  describe('project subdirectories', () => {
    it('returns null for project subdirectories when no project', () => {
      const locator = new ConfigLocator({ cwd: tmpDir });
      expect(locator.projectAgentsDir).toBeNull();
      expect(locator.projectSkillsDir).toBeNull();
      expect(locator.projectCommandsDir).toBeNull();
    });

    it('returns project subdirectories when project exists', () => {
      mkdirSync(path.join(tmpDir, '.claude'));
      const locator = new ConfigLocator({ cwd: tmpDir });
      expect(locator.projectAgentsDir).toBe(path.join(tmpDir, '.claude', 'agents'));
      expect(locator.projectSkillsDir).toBe(path.join(tmpDir, '.claude', 'skills'));
      expect(locator.projectCommandsDir).toBe(path.join(tmpDir, '.claude', 'commands'));
    });
  });

  describe('AGENT_DIR_NAME constant', () => {
    it('equals .claude', () => {
      expect(AGENT_DIR_NAME).toBe('.claude');
    });
  });
});