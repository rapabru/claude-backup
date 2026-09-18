import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runBackup } from '../src/commands/backup.js';
import { runRestore } from '../src/commands/restore.js';
import { readManifest } from '../src/archive.js';

async function makeFakeHome(suffix) {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), `claude-backup-test-${suffix}-`));
  const claudeDir = path.join(home, '.claude');
  await fs.mkdir(claudeDir, { recursive: true });
  await fs.writeFile(path.join(claudeDir, 'settings.json'), JSON.stringify({ model: 'sonnet' }, null, 2));
  await fs.writeFile(path.join(claudeDir, 'CLAUDE.md'), '# global instructions');
  await fs.writeFile(path.join(claudeDir, '.credentials.json'), JSON.stringify({ token: 'top-secret-oauth-token' }));

  const skillsDir = path.join(claudeDir, 'skills', 'my-skill');
  await fs.mkdir(skillsDir, { recursive: true });
  await fs.writeFile(path.join(skillsDir, 'SKILL.md'), '# my skill body');

  return home;
}

test('backup then restore round-trips plaintext and encrypted content correctly', async () => {
  const sourceHome = await makeFakeHome('source');
  const destHome = await makeFakeHome('dest'); // simulates "another device" with its own pre-existing state
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-backup-test-archive-'));
  const archivePath = path.join(outputDir, 'backup.zip');

  try {
    await runBackup({
      home: sourceHome,
      platform: 'darwin',
      output: archivePath,
      profile: [],
      passphrase: 'correct horse battery staple',
      extraPath: [],
    });

    const manifest = readManifest(archivePath);
    assert.ok(manifest.items.length > 0);

    const credsEntry = manifest.items.find((i) => i.id === 'code.credentials');
    assert.equal(credsEntry.encrypted, true);

    // Mutate the destination's existing settings.json so we can verify
    // restore actually overwrites it (and that the conflict gets backed up).
    await fs.writeFile(path.join(destHome, '.claude', 'settings.json'), JSON.stringify({ model: 'stale' }));

    await runRestore(archivePath, {
      home: destHome,
      platform: 'darwin',
      all: true,
      passphrase: 'correct horse battery staple',
    });

    const restoredSettings = JSON.parse(await fs.readFile(path.join(destHome, '.claude', 'settings.json'), 'utf8'));
    assert.equal(restoredSettings.model, 'sonnet');

    const restoredCreds = JSON.parse(await fs.readFile(path.join(destHome, '.claude', '.credentials.json'), 'utf8'));
    assert.equal(restoredCreds.token, 'top-secret-oauth-token');

    const restoredSkill = await fs.readFile(
      path.join(destHome, '.claude', 'skills', 'my-skill', 'SKILL.md'),
      'utf8'
    );
    assert.equal(restoredSkill, '# my skill body');
  } finally {
    await fs.rm(sourceHome, { recursive: true, force: true });
    await fs.rm(destHome, { recursive: true, force: true });
    await fs.rm(outputDir, { recursive: true, force: true });
  }
});

test('restoring with the wrong passphrase throws instead of writing garbage', async () => {
  const sourceHome = await makeFakeHome('source2');
  const destHome = await makeFakeHome('dest2');
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-backup-test-archive2-'));
  const archivePath = path.join(outputDir, 'backup.zip');

  try {
    await runBackup({
      home: sourceHome,
      platform: 'darwin',
      output: archivePath,
      profile: [],
      passphrase: 'the-real-passphrase',
      extraPath: [],
    });

    await assert.rejects(
      () =>
        runRestore(archivePath, {
          home: destHome,
          platform: 'darwin',
          all: true,
          passphrase: 'wrong-passphrase',
        }),
      /Decryption failed/
    );
  } finally {
    await fs.rm(sourceHome, { recursive: true, force: true });
    await fs.rm(destHome, { recursive: true, force: true });
    await fs.rm(outputDir, { recursive: true, force: true });
  }
});
