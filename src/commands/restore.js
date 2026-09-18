import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import prompts from 'prompts';
import { getBasePaths } from '../discovery/os-paths.js';
import { buildCatalog } from '../discovery/rules.js';
import { readManifest, readItemContent } from '../archive.js';
import { ensureDir, pathExists } from '../utils/fs-helpers.js';

export async function runRestore(archivePath, options) {
  const manifest = readManifest(archivePath);

  if (manifest.items.length === 0) {
    console.log('This backup is empty.');
    return;
  }

  const toRestore = await selectItems(manifest, options);
  if (toRestore.length === 0) {
    console.log('Nothing selected. Aborted.');
    return;
  }

  const needsPassphrase = toRestore.some((i) => i.encrypted);
  let passphrase = options.passphrase;
  if (needsPassphrase && !passphrase) {
    const answer = await prompts({
      type: 'password',
      name: 'passphrase',
      message: 'This backup contains encrypted credentials. Enter the passphrase:',
    });
    passphrase = answer.passphrase;
    if (!passphrase) {
      console.log('Aborted: passphrase required.');
      process.exitCode = 1;
      return;
    }
  }

  const currentCatalog = buildCatalog(getBasePaths(options.platform, options.home));
  const byId = new Map(currentCatalog.map((c) => [c.id, c]));

  const safetyDir = path.join(os.tmpdir(), 'claude-backup-safety', new Date().toISOString().replace(/[:.]/g, '-'));
  let conflictsBackedUp = 0;

  for (const item of toRestore) {
    const destBase = resolveDestination(item, byId);
    if (!destBase) {
      console.log(`  skip: no destination mapping for "${item.label}" on this machine (external path: ${item.path})`);
      continue;
    }

    const content = readItemContent(archivePath, item, passphrase);

    for (const [relPath, buf] of content) {
      const dest = relPath ? path.join(destBase, relPath) : destBase;

      if (await pathExists(dest)) {
        await backupConflict(dest, safetyDir);
        conflictsBackedUp++;
      }

      await ensureDir(path.dirname(dest));
      await fs.writeFile(dest, buf);
    }

    console.log(`  restored: ${item.label} -> ${destBase}`);
  }

  if (conflictsBackedUp > 0) {
    console.log(`\n${conflictsBackedUp} existing file(s) were overwritten; originals saved to ${safetyDir}`);
  }
  console.log(`\nRestore complete: ${toRestore.length} item(s).`);
}

async function selectItems(manifest, options) {
  if (options.all) return manifest.items;

  if (options.items && options.items.length > 0) {
    return manifest.items.filter((i) => options.items.includes(i.id));
  }

  const answer = await prompts({
    type: 'multiselect',
    name: 'ids',
    message: 'Select what to restore',
    choices: manifest.items.map((i) => ({
      title: `${i.sensitive ? '[encrypted] ' : ''}${i.category.padEnd(10)} ${i.label}`,
      value: i.id,
      selected: true,
    })),
  });

  return manifest.items.filter((i) => (answer.ids || []).includes(i.id));
}

function resolveDestination(manifestItem, currentCatalogById) {
  const current = currentCatalogById.get(manifestItem.id);
  if (current) return current.path;
  // External / unmapped path (e.g. an `extra.*` skills repo): fall back
  // to the path recorded at backup time.
  return manifestItem.path || null;
}

async function backupConflict(existingPath, safetyDir) {
  const rel = existingPath.replace(/^\/+/, '').replace(/:/g, '');
  const dest = path.join(safetyDir, rel);
  await ensureDir(path.dirname(dest));
  const stat = await fs.stat(existingPath);
  if (stat.isDirectory()) {
    await fs.cp(existingPath, dest, { recursive: true });
  } else {
    await fs.copyFile(existingPath, dest);
  }
}
