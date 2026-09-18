import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { discover } from '../src/discovery/index.js';
import { getBasePaths } from '../src/discovery/os-paths.js';

async function makeFakeHome() {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-backup-test-home-'));
  const claudeDir = path.join(home, '.claude');
  await fs.mkdir(claudeDir, { recursive: true });
  await fs.writeFile(path.join(claudeDir, 'settings.json'), JSON.stringify({ model: 'sonnet' }));
  await fs.writeFile(path.join(claudeDir, 'CLAUDE.md'), '# hello');
  await fs.writeFile(path.join(claudeDir, '.credentials.json'), JSON.stringify({ token: 'super-secret-value' }));

  const skillsDir = path.join(claudeDir, 'skills', 'my-skill');
  await fs.mkdir(skillsDir, { recursive: true });
  await fs.writeFile(path.join(skillsDir, 'SKILL.md'), '# my skill');

  return home;
}

test('discovers files that exist and skips ones that do not', async () => {
  const home = await makeFakeHome();
  try {
    const { items } = await discover({ platform: 'darwin', home });

    const ids = items.map((i) => i.id);
    assert.ok(ids.includes('code.settings'));
    assert.ok(ids.includes('code.claude-md'));
    assert.ok(ids.includes('code.credentials'));
    assert.ok(ids.includes('code.skills'));

    // Never existed in the fake home -> must not be reported as found.
    assert.ok(!ids.includes('code.settings-local'));
    assert.ok(!ids.includes('code.history'));
  } finally {
    await fs.rm(home, { recursive: true, force: true });
  }
});

test('flags .credentials.json as sensitive', async () => {
  const home = await makeFakeHome();
  try {
    const { items } = await discover({ platform: 'darwin', home });
    const creds = items.find((i) => i.id === 'code.credentials');
    assert.equal(creds.sensitive, true);
  } finally {
    await fs.rm(home, { recursive: true, force: true });
  }
});

test('heuristic scan flags a plain settings.json containing an embedded token', async () => {
  const home = await makeFakeHome();
  try {
    const claudeDir = path.join(home, '.claude');
    await fs.writeFile(
      path.join(claudeDir, 'settings.json'),
      JSON.stringify({ mcpServers: { foo: { apiKey: 'sk-abc123-should-be-flagged' } } })
    );

    const { items } = await discover({ platform: 'darwin', home });
    const settings = items.find((i) => i.id === 'code.settings');
    assert.equal(settings.sensitive, true);
  } finally {
    await fs.rm(home, { recursive: true, force: true });
  }
});

test('resolves platform-specific Claude Desktop base path', () => {
  const mac = getBasePaths('darwin', '/Users/x');
  assert.equal(mac.claudeDesktop, '/Users/x/Library/Application Support/Claude');

  const linux = getBasePaths('linux', '/home/x');
  assert.equal(linux.claudeDesktop, '/home/x/.config/Claude');
});
