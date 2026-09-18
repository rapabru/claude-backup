import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Recursively lists every regular file under `root`, returning paths
 * relative to `root` (posix-style, so they're stable across OSes inside
 * the archive).
 */
export async function walkFiles(root) {
  const results = [];

  async function walk(dir, relBase) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(abs, rel);
      } else if (entry.isFile()) {
        results.push({ abs, rel });
      }
    }
  }

  await walk(root, '');
  return results;
}

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
