import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import prompts from 'prompts';
import { getBasePaths } from '../discovery/os-paths.js';
import { buildCatalog } from '../discovery/rules.js';
import { readManifest, readItemContent } from '../archive.js';
import { pathExists } from '../utils/fs-helpers.js';

function hash(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export async function runDiff(archivePath, options) {
  const manifest = readManifest(archivePath);
  const currentCatalog = buildCatalog(getBasePaths(options.platform, options.home));
  const byId = new Map(currentCatalog.map((c) => [c.id, c]));

  let passphrase = options.passphrase;
  const hasEncrypted = manifest.items.some((i) => i.encrypted);
  if (hasEncrypted && !options.skipEncrypted && !passphrase) {
    const answer = await prompts({
      type: 'password',
      name: 'passphrase',
      message: 'Backup contains encrypted items. Enter passphrase to include them in the diff (leave empty to skip):',
    });
    passphrase = answer.passphrase || null;
  }

  const rows = [];

  for (const item of manifest.items) {
    const current = byId.get(item.id);
    const destBase = current ? current.path : item.path;

    if (item.encrypted && !passphrase) {
      rows.push({ item, status: 'skipped (encrypted, no passphrase)' });
      continue;
    }

    let backupContent;
    try {
      backupContent = readItemContent(archivePath, item, passphrase);
    } catch (err) {
      rows.push({ item, status: `error: ${err.message}` });
      continue;
    }

    for (const [relPath, buf] of backupContent) {
      const dest = relPath ? path.join(destBase, relPath) : destBase;
      const label = relPath ? `${item.label} (${relPath})` : item.label;

      if (!(await pathExists(dest))) {
        rows.push({ item, label, status: 'missing on this device' });
        continue;
      }

      const currentBuf = await fs.readFile(dest);
      rows.push({
        item,
        label,
        status: hash(currentBuf) === hash(buf) ? 'unchanged' : 'modified',
      });
    }
  }

  printDiff(rows, manifest);
}

function printDiff(rows, manifest) {
  console.log(`Backup: created ${manifest.createdAt} on ${manifest.hostname} (${manifest.platform})\n`);

  const changed = rows.filter((r) => r.status !== 'unchanged');
  const unchanged = rows.length - changed.length;

  for (const r of rows) {
    if (r.status === 'unchanged') continue;
    console.log(`  ${r.status.padEnd(32)} ${r.label || r.item.label}`);
  }

  console.log(`\n${changed.length} changed/missing, ${unchanged} unchanged, ${rows.length} total compared.`);
}
