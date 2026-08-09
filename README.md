<p align="center">
  <a href="https://github.com/JiangWeixian/ohmyc/releases/latest">
    <img src="packages/desktop/src-tauri/icons/mac-computer-128x128@2x.png" alt="Download OhMyC" width="128" />
  </a>
</p>

# OhMyC

[![GitHub release](https://img.shields.io/github/v/release/JiangWeixian/ohmyc?include_prereleases&style=flat-square)](https://github.com/JiangWeixian/ohmyc/releases)
[![CI](https://github.com/JiangWeixian/ohmyc/actions/workflows/ci.yml/badge.svg)](https://github.com/JiangWeixian/ohmyc/actions/workflows/ci.yml)

[中文说明](README.zh-CN.md)

OhMyC shows you what your AI coding tools have been up to. Claude Code, Codex,
and OpenCode each keep their own records; OhMyC puts them in one window: what
ran, when, how many tokens it cost, which projects you actually spent time in.
It also lists the agents, skills, commands, and plugins sitting on your machine.
Nothing leaves your computer.

<p align="center">
  <a href="https://github.com/JiangWeixian/ohmyc/releases/latest">
    <img src="docs/images/ohmyc-feature-overview-no-shadow.png" alt="OhMyC Monitor, Timeline, and the menu bar popover" width="100%" />
  </a>
</p>

## Getting started

Three steps, and the next session you run shows up in the app.

### 1. Download and install

Grab the newest build from the
[Releases page](https://github.com/JiangWeixian/ohmyc/releases/latest), install
it, and launch **OhMyC**.

### 2. Install the plugin for your agent

OhMyC opens on **Monitor not connected**, because nothing is recording your
sessions yet. That job belongs to a plugin. Install the one for the tool you
use:

**Claude Code**

```text
/plugin marketplace add JiangWeixian/ohmyc-plugins
/plugin install timeline@ohmyc
```

**Codex**

```bash
codex plugin marketplace add JiangWeixian/ohmyc-plugins
```

Then run `codex`, open `/plugins`, and install **OhMyC Timeline** from the
`ohmyc` marketplace.

**OpenCode** — add the package to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@ohmyc/timeline-plugin"]
}
```

Full details, requirements, and configuration:
[ohmyc-plugins](https://github.com/JiangWeixian/ohmyc-plugins).

### 3. Click Check again

Back in OhMyC. The screen switches over, and from here on your sessions land in
Monitor and Timeline on their own.

Nothing showing up? See
[when something looks wrong](#when-something-looks-wrong) below.

## Around the app

| Screen | What it is for |
| --- | --- |
| **Monitor** | Recent activity at a glance. You land here. |
| **Timeline** | Days and projects, down to single sessions and turns. |
| **Explorer** | The agents, skills, commands, and plugins on this machine. |
| **Menu bar** (Mac) | Heatmap and chart without opening the window. |

Press **⌘K** to switch theme (Monitor, Phosphor Mono, Amber CRT, Retro Wave,
Cyberpunk) and pick calm or expressive intensity. To move around: `g m`
Monitor, `g t` Timeline, `g a` Agents, `g s` Skills, `g c` Commands.

## Your data

Everything OhMyC collects sits in `~/.config/ohmyc/` on your own machine. No
account, no upload, no sync. Delete that folder and it is gone. If you keep
your files somewhere else, set `OHMYC_HOME` to point there.

<details>
<summary>Where Explorer goes looking</summary>

| Source | Paths |
| --- | --- |
| Claude | `~/.claude/`, project `.claude/` |
| Codex | `~/.codex/`, project `.codex/` |
| OpenCode | `~/.config/opencode/` (or Application Support on Mac), project `.opencode/` |
| Shared skills | `~/.agents/skills/`, project `.agents/skills/` |

A skill under `.agents` can belong to more than one tool, so it may show
several origins (codex and opencode, say).

</details>

## When something looks wrong

| What you see | What to do |
| --- | --- |
| Monitor not connected | Finish step 2, then click **Check again** |
| Timeline is empty | The plugin records sessions as they finish, so run one after installing it |
| Explorer is empty | Check that the folders above exist, and clear the source filter |

Still stuck? Open an
[issue](https://github.com/JiangWeixian/ohmyc/issues) and say which agent you
use, what you did, and what you saw.

---

Built with love =^._.^=
