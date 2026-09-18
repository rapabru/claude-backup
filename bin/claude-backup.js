#!/usr/bin/env node
import { Command } from 'commander';
import { runBackup } from '../src/commands/backup.js';
import { runRestore } from '../src/commands/restore.js';
import { runDiff } from '../src/commands/diff.js';
import { runStatus } from '../src/commands/status.js';
import { ALL_CATEGORIES } from '../src/profiles.js';

const program = new Command();

program
  .name('claude-backup')
  .description('Back up and restore your Claude Code / Claude Desktop configuration across devices.')
  .version('0.1.0');

function collect(value, previous) {
  return previous.concat([value]);
}

program
  .command('backup')
  .description('Scan this device and write an encrypted backup archive.')
  .option('-o, --output <path>', 'output .zip path')
  .option('--profile <category>', `only include a category (${ALL_CATEGORIES.join(', ')}) — repeatable`, collect, [])
  .option('--include-history', 'include session/project history (excluded by default)')
  .option('--extra-path <path>', 'additional path to include (e.g. an external skills repo) — repeatable', collect, [])
  .option('--passphrase <passphrase>', 'passphrase for encrypting sensitive items (skips the prompt; prefer letting it prompt interactively)')
  .action(runBackup);

program
  .command('restore <archive>')
  .description('Restore items from a backup archive, with conflict-safe overwrites.')
  .option('-a, --all', 'restore everything without prompting')
  .option('--items <id>', 'restore only this item id — repeatable', collect, [])
  .option('--passphrase <passphrase>', 'passphrase for decrypting sensitive items')
  .action(runRestore);

program
  .command('status')
  .description('Show what a backup would currently include on this device (no archive involved).')
  .option('--profile <category>', `only include a category (${ALL_CATEGORIES.join(', ')}) — repeatable`, collect, [])
  .option('--include-history', 'include session/project history (excluded by default)')
  .option('--extra-path <path>', 'additional path to include — repeatable', collect, [])
  .action(runStatus);

program
  .command('diff <archive>')
  .description("Compare this device's current config against a given backup archive.")
  .option('--passphrase <passphrase>', 'passphrase for decrypting sensitive items to include them in the diff')
  .option('--skip-encrypted', "don't prompt for a passphrase; skip encrypted items in the diff")
  .action(runDiff);

program.parseAsync(process.argv);
