import os from 'node:os';
import path from 'node:path';

/**
 * Base directories for each Claude surface, per OS.
 * Claude Code (the CLI) resolves its home the same way on every platform
 * (via the user's home directory), so it does not need per-OS branching.
 * Claude Desktop uses each OS's native "application support" convention.
 */
export function getBasePaths(platform = process.platform, home = os.homedir()) {
  const claudeCode = path.join(home, '.claude');

  let claudeDesktop;
  if (platform === 'darwin') {
    claudeDesktop = path.join(home, 'Library', 'Application Support', 'Claude');
  } else if (platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    claudeDesktop = path.join(appData, 'Claude');
  } else {
    // Linux: no official Anthropic desktop build; community/unofficial
    // packages generally follow the XDG convention.
    const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
    claudeDesktop = path.join(xdgConfig, 'Claude');
  }

  return { home, claudeCode, claudeDesktop, platform };
}
