import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'fs';
import path from 'path';
import os from 'os';
import { ConfigLocator, AGENT_DIR_NAME, WRITE_DIR_NAME } from '../configLocator';

describe('ConfigLocator', () => {
  let tmpDir: string;
  let savedAgentHome: string | undefined;
  let savedCuiHome: string | undefined;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'config-locator-test-'));
    savedAgentHome = process.env.AGENT_HOME;
    savedCuiHome = process.env.CUI_HOME;
    delete process.env.AGENT_HOME;
    delete process.env.CUI_HOME;
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    if (savedAgentHome !== undefined) {
      process.env.AGENT_HOME = savedAgentHome;
    } else {
      delete process.env.AGENT_HOME;
    }
    if (savedCuiHome !== undefined) {
      process.env.CUI_HOME = savedCuiHome;
    } else {
      delete process.env.CUI_HOME;
    }
  });

  describe('constants', () => {
    it('AGENT_DIR_NAME equals .claude', () => {
      expect(AGENT_DIR_NAME).toBe('.claude');
    });

    it('WRITE_DIR_NAME equals .cui', () => {
      expect(WRITE_DIR_NAME).toBe('.cui');
    });
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

    it('project discovery still checks cwd/.claude/ when AGENT_HOME is NOT set', () => {
      // D-01, D-10: project dir always .claude/ unless AGENT_HOME overrides
      mkdirSync(path.join(tmpDir, '.claude'));
      const locator = new ConfigLocator({ cwd: tmpDir });
      expect(locator.projectPath).toBe(path.join(tmpDir, '.claude'));
    });

    it('project discovery uses AGENT_HOME override dir when set', () => {
      process.env.AGENT_HOME = '.custom-claude';
      mkdirSync(path.join(tmpDir, '.custom-claude'));
      const locator = new ConfigLocator({ cwd: tmpDir });
      expect(locator.hasProject).toBe(true);
      expect(locator.projectPath).toBe(path.join(tmpDir, '.custom-claude'));
    });
  });

  describe('write path rebrand', () => {
    it('baseDir resolves to ~/.cui/ (not ~/.claude/)', () => {
      const locator = new ConfigLocator({ cwd: tmpDir });
      expect(locator.baseDir).toBe(path.join(os.homedir(), '.cui'));
    });

    it('agentsDir resolves to ~/.cui/agents/', () => {
      const locator = new ConfigLocator({ cwd: tmpDir });
      expect(locator.agentsDir).toBe(path.join(os.homedir(), '.cui', 'agents'));
    });

    it('skillsDir resolves to ~/.cui/skills/', () => {
      const locator = new ConfigLocator({ cwd: tmpDir });
      expect(locator.skillsDir).toBe(path.join(os.homedir(), '.cui', 'skills'));
    });

    it('commandsDir resolves to ~/.cui/commands/', () => {
      const locator = new ConfigLocator({ cwd: tmpDir });
      expect(locator.commandsDir).toBe(path.join(os.homedir(), '.cui', 'commands'));
    });

    it('settingsPath resolves to ~/.cui/settings.json', () => {
      const locator = new ConfigLocator({ cwd: tmpDir });
      expect(locator.settingsPath).toBe(path.join(os.homedir(), '.cui', 'settings.json'));
    });

    it('pluginsDir resolves to ~/.claude/plugins/ (NOT ~/.cui/plugins/) per D-03', () => {
      const locator = new ConfigLocator({ cwd: tmpDir });
      expect(locator.pluginsDir).toBe(path.join(os.homedir(), '.claude', 'plugins'));
    });

    it('readBaseDir equals writeBaseDir (both ~/.cui/) per D-04', () => {
      const locator = new ConfigLocator({ cwd: tmpDir });
      expect(locator.readBaseDir).toBe(locator.baseDir);
      expect(locator.readBaseDir).toBe(path.join(os.homedir(), '.cui'));
    });

    it('fresh install — ConfigLocator creates valid paths even when ~/.cui/ does not exist', () => {
      // No mkdir — ~/.cui/ doesn't exist. ConfigLocator should still return valid paths.
      const locator = new ConfigLocator({ cwd: tmpDir });
      expect(locator.baseDir).toBe(path.join(os.homedir(), '.cui'));
      expect(locator.agentsDir).toBe(path.join(os.homedir(), '.cui', 'agents'));
      expect(locator.settingsPath).toBe(path.join(os.homedir(), '.cui', 'settings.json'));
    });
  });

  describe('AGENT_HOME env var with split paths', () => {
    it('AGENT_HOME overrides claudeCodeDir (plugins) and project discovery, NOT writeBaseDir', () => {
      process.env.AGENT_HOME = '.custom-claude';
      const locator = new ConfigLocator({ cwd: tmpDir });
      expect(locator.baseDir).toBe(path.join(os.homedir(), '.cui'));
      expect(locator.agentsDir).toBe(path.join(os.homedir(), '.cui', 'agents'));
      expect(locator.pluginsDir).toBe(path.join(os.homedir(), '.custom-claude', 'plugins'));
    });
  });

  describe('CUI_HOME env var override', () => {
    it('CUI_HOME overrides writeBaseDir', () => {
      process.env.CUI_HOME = '.custom-cui';
      const locator = new ConfigLocator({ cwd: tmpDir });
      expect(locator.baseDir).toBe(path.join(os.homedir(), '.custom-cui'));
      expect(locator.agentsDir).toBe(path.join(os.homedir(), '.custom-cui', 'agents'));
      expect(locator.settingsPath).toBe(path.join(os.homedir(), '.custom-cui', 'settings.json'));
    });

    it('CUI_HOME does not affect claudeCodeDir (plugins still from ~/.claude/)', () => {
      process.env.CUI_HOME = '.custom-cui';
      const locator = new ConfigLocator({ cwd: tmpDir });
      expect(locator.pluginsDir).toBe(path.join(os.homedir(), '.claude', 'plugins'));
    });

    it('CUI_HOME and AGENT_HOME can be set independently', () => {
      process.env.CUI_HOME = '.custom-cui';
      process.env.AGENT_HOME = '.custom-claude';
      const locator = new ConfigLocator({ cwd: tmpDir });
      expect(locator.baseDir).toBe(path.join(os.homedir(), '.custom-cui'));
      expect(locator.pluginsDir).toBe(path.join(os.homedir(), '.custom-claude', 'plugins'));
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
});