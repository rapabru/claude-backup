import fs from 'node:fs/promises';
import { getBasePaths } from './os-paths.js';
import { buildCatalog } from './rules.js';
import { fileLooksSensitive } from './secrets-scan.js';

/**
 * Runs the rule catalog against the real filesystem and returns only the
 * items that actually exist, each annotated with its resolved sensitivity
 * and (for files) size. This is intentionally conservative: a rule that
 * doesn't match anything on disk is simply omitted, never invented.
 *
 * @param {object} [opts]
 * @param {string} [opts.platform] override for tests
 * @param {string} [opts.home] override for tests
 * @param {string[]} [opts.extraPaths] additional absolute paths to probe
 *   (e.g. locally-cloned external skill repos the user points at)
 */
export async function discover(opts = {}) {
  const basePaths = getBasePaths(opts.platform, opts.home);
  const catalog = buildCatalog(basePaths);

  if (opts.extraPaths) {
    for (const p of opts.extraPaths) {
      catalog.push({
        id: `extra.${p}`,
        category: 'skills-external',
        label: `External skills/config: ${p}`,
        path: p,
        type: 'dir',
        sensitive: false,
        defaultInclude: true,
      });
    }
  }

  const found = [];
  for (const item of catalog) {
    const stat = await statSafe(item.path);
    if (!stat) continue;

    const isDirRule = item.type === 'dir';
    if (isDirRule && !stat.isDirectory()) continue;
    if (!isDirRule && !stat.isFile()) continue;

    let sensitive = item.sensitive;
    if (!sensitive && stat.isFile() && item.path.endsWith('.json')) {
      const raw = await fs.readFile(item.path, 'utf8').catch(() => null);
      if (raw && fileLooksSensitive(raw)) sensitive = true;
    }

    found.push({
      ...item,
      sensitive,
      exists: true,
      size: stat.isFile() ? stat.size : await dirSize(item.path),
      mtime: stat.mtime.toISOString(),
    });
  }

  return { basePaths, items: found };
}

async function statSafe(p) {
  try {
    return await fs.stat(p);
  } catch {
    return null;
  }
}

async function dirSize(dirPath) {
  let total = 0;
  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = `${dirPath}/${entry.name}`;
    if (entry.isDirectory()) {
      total += await dirSize(full);
    } else {
      const s = await statSafe(full);
      if (s) total += s.size;
    }
  }
  return total;
}
