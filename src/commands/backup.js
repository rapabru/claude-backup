import os from 'node:os';
import path from 'node:path';
import prompts from 'prompts';
import { discover } from '../discovery/index.js';
import { filterItems } from '../profiles.js';
import { createArchive } from '../archive.js';

export async function runBackup(options) {
  const { basePaths, items } = await discover({
    extraPaths: options.extraPath,
    platform: options.platform,
    home: options.home,
  });
  const selected = filterItems(items, { profile: options.profile, includeHistory: options.includeHistory });

  if (selected.length === 0) {
    console.log('Nothing found to back up with the current profile/flags.');
    return;
  }

  const sensitiveCount = selected.filter((i) => i.sensitive).length;
  let passphrase = options.passphrase;
  if (sensitiveCount > 0 && !passphrase) {
    const answer = await prompts({
      type: 'password',
      name: 'passphrase',
      message: `${sensitiveCount} sensitive file(s) found (credentials/tokens). Enter a passphrase to encrypt them:`,
      validate: (v) => (v.length >= 8 ? true : 'Use at least 8 characters.'),
    });
    if (!answer.passphrase) {
      console.log('Aborted: a passphrase is required to back up credentials.');
      process.exitCode = 1;
      return;
    }
    passphrase = answer.passphrase;
  }

  const outputPath = options.output || defaultOutputPath();

  console.log(`Backing up ${selected.length} item(s):`);
  for (const item of selected) {
    console.log(`  ${item.sensitive ? '[encrypted]' : '           '} ${item.category.padEnd(15)} ${item.label}`);
  }

  const manifest = await createArchive({
    outputPath,
    items: selected,
    passphrase,
    meta: {
      hostname: os.hostname(),
      platform: basePaths.platform,
      generator: 'claude-backup',
    },
  });

  console.log(`\nBackup written to ${outputPath}`);
  console.log(`${manifest.items.filter((i) => i.encrypted).length} file(s) encrypted, ${manifest.items.length} total item(s).`);
}

function defaultOutputPath() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.resolve(`claude-backup-${stamp}.zip`);
}
