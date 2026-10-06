// Where each agent harness looks for skills, with the official page each path
// was verified against. `verified: false` means the docs name no skills folder
// for that harness (or not for that scope), so the command refuses to guess
// and asks for --dir instead. A made-up path that looks right is worse than an
// honest "I do not know".

export const HARNESSES = {
  claude: {
    label: 'Claude Code',
    global: {
      path: '~/.claude/skills',
      verified: true,
      source: 'https://code.claude.com/docs/en/skills',
    },
    project: {
      path: '.claude/skills',
      verified: true,
      source: 'https://code.claude.com/docs/en/skills',
    },
  },
  codex: {
    label: 'Codex',
    // Codex reads AGENTS.md files (global ~/.codex/AGENTS.md, per-directory
    // AGENTS.md). The official docs describe no skills folder, so there is
    // nothing verified to install into; the command asks for --dir instead.
    global: {
      path: null,
      verified: false,
      source: 'https://developers.openai.com/codex/guides/agents-md',
      note: 'Codex reads AGENTS.md files, not a skills folder, so its docs give no place to install one.',
    },
    project: {
      path: null,
      verified: false,
      source: 'https://developers.openai.com/codex/guides/agents-md',
      note: 'Codex reads AGENTS.md files, not a skills folder, so its docs give no place to install one.',
    },
  },
  hermes: {
    label: 'Hermes',
    global: {
      path: '~/.hermes/skills',
      verified: true,
      source: 'https://hermes-agent.nousresearch.com/docs/user-guide/features/skills/',
    },
    project: {
      path: '.hermes/skills',
      verified: true,
      source: 'https://hermes-agent.nousresearch.com/docs/user-guide/features/skills/',
    },
  },
  opencode: {
    label: 'OpenCode',
    global: {
      path: '~/.config/opencode/skills',
      verified: true,
      source: 'https://opencode.ai/docs/skills/',
    },
    project: {
      path: '.opencode/skills',
      verified: true,
      source: 'https://opencode.ai/docs/skills/',
    },
  },
};

export const HARNESS_NAMES = Object.keys(HARNESSES);
