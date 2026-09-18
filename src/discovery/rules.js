import path from 'node:path';

/**
 * Builds the full catalog of candidate items to look for, given the
 * resolved base paths for this OS. Nothing here asserts that a path
 * exists — that check happens at runtime in discovery/index.js — this
 * is just the map of "where things could plausibly be".
 *
 * category:  used by --profile to select a subset (settings|skills|
 *            credentials|plugins|history|desktop)
 * sensitive: true => always encrypted in the archive, never logged
 * defaultInclude: false => only included when the user explicitly
 *            opts in (via --include-cache / --include-history)
 */
export function buildCatalog(basePaths) {
  const { claudeCode, claudeDesktop, platform } = basePaths;
  const items = [];

  const add = (item) => items.push({ type: 'file', sensitive: false, defaultInclude: true, ...item });

  // ---- Claude Code (CLI) ----------------------------------------------
  add({
    id: 'code.settings',
    category: 'settings',
    label: 'Claude Code settings.json',
    path: path.join(claudeCode, 'settings.json'),
  });
  add({
    id: 'code.settings-local',
    category: 'settings',
    label: 'Claude Code settings.local.json',
    path: path.join(claudeCode, 'settings.local.json'),
  });
  add({
    id: 'code.claude-md',
    category: 'settings',
    label: 'Global CLAUDE.md',
    path: path.join(claudeCode, 'CLAUDE.md'),
  });
  add({
    id: 'code.credentials',
    category: 'credentials',
    label: 'Claude Code OAuth credentials',
    path: path.join(claudeCode, '.credentials.json'),
    sensitive: true,
  });
  add({
    id: 'code.skills',
    category: 'skills',
    label: 'Custom skills',
    path: path.join(claudeCode, 'skills'),
    type: 'dir',
  });
  add({
    id: 'code.plugins-installed',
    category: 'plugins',
    label: 'Installed plugins manifest',
    path: path.join(claudeCode, 'plugins', 'installed_plugins.json'),
  });
  add({
    id: 'code.plugins-marketplaces-known',
    category: 'plugins',
    label: 'Known plugin marketplaces',
    path: path.join(claudeCode, 'plugins', 'known_marketplaces.json'),
  });
  add({
    id: 'code.plugins-marketplaces-dir',
    category: 'plugins',
    label: 'Plugin marketplace metadata',
    path: path.join(claudeCode, 'plugins', 'marketplaces'),
    type: 'dir',
  });
  add({
    id: 'code.plugins-data',
    category: 'plugins',
    label: 'Plugin data (external skill/tool dirs)',
    path: path.join(claudeCode, 'plugins', 'data'),
    type: 'dir',
  });
  add({
    id: 'code.commands',
    category: 'settings',
    label: 'Custom slash commands',
    path: path.join(claudeCode, 'commands'),
    type: 'dir',
  });
  add({
    id: 'code.agents',
    category: 'settings',
    label: 'Custom subagents',
    path: path.join(claudeCode, 'agents'),
    type: 'dir',
  });
  add({
    id: 'code.hooks',
    category: 'settings',
    label: 'Custom hooks directory',
    path: path.join(claudeCode, 'hooks'),
    type: 'dir',
  });
  add({
    id: 'code.keybindings',
    category: 'settings',
    label: 'Custom keybindings',
    path: path.join(claudeCode, 'keybindings.json'),
  });
  add({
    id: 'code.projects',
    category: 'history',
    label: 'Project/session metadata',
    path: path.join(claudeCode, 'projects'),
    type: 'dir',
    defaultInclude: false,
  });
  add({
    id: 'code.sessions',
    category: 'history',
    label: 'Session state',
    path: path.join(claudeCode, 'sessions'),
    type: 'dir',
    defaultInclude: false,
  });
  add({
    id: 'code.history',
    category: 'history',
    label: 'Command history log',
    path: path.join(claudeCode, 'history.jsonl'),
    defaultInclude: false,
  });

  // Some Claude Code versions store user-level MCP server config in a
  // top-level dotfile instead of settings.json. Detect it if present.
  add({
    id: 'code.dotfile-json',
    category: 'settings',
    label: 'Top-level ~/.claude.json (MCP servers, etc.)',
    path: path.join(basePaths.home, '.claude.json'),
  });

  // ---- Claude Desktop app ----------------------------------------------
  // Whitelist of known, non-cache config files. Deliberately NOT a
  // blacklist of the Electron cache dirs (Cache/, IndexedDB/, Cookies,
  // Crashpad/, ...) — those change across app versions and are never
  // config, so we only ever opt IN to specific known files.
  const desktopFiles = [
    ['desktop.config', 'claude_desktop_config.json', false, 'Claude Desktop app config'],
    ['desktop.config-full', 'config.json', true, 'Claude Desktop app state (contains OAuth token cache)'],
    ['desktop.mcp-toggles', 'mcp-user-tool-toggles.json', false, 'MCP tool enable/disable toggles'],
    ['desktop.git-worktrees', 'git-worktrees.json', false, 'Git worktree bookkeeping'],
    ['desktop.extensions-blocklist', 'extensions-blocklist.json', false, 'Extension blocklist'],
  ];
  for (const [id, file, sensitive, label] of desktopFiles) {
    add({
      id,
      category: 'desktop',
      label,
      path: path.join(claudeDesktop, file),
      sensitive,
    });
  }

  return items;
}
