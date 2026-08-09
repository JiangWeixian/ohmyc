import type { Agent, Skill } from '@ohmyc/shared'

export const e2eAgents: Agent[] = [
  {
    id: 'review-agent',
    frontmatter: {
      name: 'Review Agent',
      description: 'Reviews implementation changes before they land.',
      model: 'claude-opus-4-1',
    },
    content: 'Reviews implementation changes across product-critical UI surfaces.',
    raw: '---\nname: Review Agent\n---\nReviews implementation changes.',
    filename: 'review-agent.md',
    source: 'local',
    scope: 'global',
  },
  {
    id: 'debug-agent',
    frontmatter: {
      name: 'Debug Agent',
      description: 'Root-causes bugs systematically.',
      model: 'claude-sonnet-4-20250514',
    },
    content: 'Systematic debugging with root cause analysis.',
    raw: '---\nname: Debug Agent\n---\nSystematic debugging.',
    filename: 'debug-agent.md',
    source: 'plugin',
    scope: 'project',
    pluginId: 'ohmyc-plugins',
  },
]

export const e2eSkills: Skill[] = [
  {
    id: 'investigate-skill',
    frontmatter: {
      name: 'investigate',
      description: 'Systematic debugging with root cause investigation.',
    },
    content: 'Four phases: investigate, analyze, hypothesize, implement.',
    raw: '---\nname: investigate\n---\nDebugging skill.',
    dirName: 'investigate',
    source: 'local',
    scope: 'global',
  },
  {
    id: 'ship-skill',
    frontmatter: {
      name: 'ship',
      description: 'Ship workflow: build, test, review, PR.',
    },
    content: 'Complete shipping pipeline.',
    raw: '---\nname: ship\n---\nShipping skill.',
    dirName: 'ship',
    source: 'plugin',
    scope: 'project',
    pluginId: 'ohmyc-plugins',
  },
]

export const e2eCommands = [
  {
    id: 'review-cmd',
    frontmatter: {
      name: 'review',
      description: 'Code review command.',
    },
    content: 'Pre-landing PR review.',
    raw: '---\nname: review\n---\nReview command.',
    filename: 'review.md',
    source: 'local',
    scope: 'global',
  },
  {
    id: 'qa-cmd',
    frontmatter: {
      name: 'qa',
      description: 'QA test command.',
    },
    content: 'Systematically QA test a web application.',
    raw: '---\nname: qa\n---\nQA command.',
    filename: 'qa.md',
    source: 'plugin',
    scope: 'project',
    pluginId: 'ohmyc-plugins',
  },
]

export const e2ePlugins = {
  plugins: [
    {
      id: 'ohmyc-plugins',
      name: 'OhMyC Plugins',
      marketplace: 'default',
      enabled: true,
      installs: [],
      manifest: null,
    },
  ],
}

export const e2eMarketplaces = {
  marketplaces: [
    { id: 'default', name: 'Default', url: 'https://github.com/JiangWeixian/ohmyc-plugins' },
  ],
}
