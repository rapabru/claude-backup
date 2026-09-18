import { discover } from '../discovery/index.js';
import { filterItems } from '../profiles.js';

/**
 * Dry-run report of what a `backup` would currently pick up on this
 * device — no archive is read or written. Use `diff <archive>` instead
 * to compare against a specific existing backup.
 */
export async function runStatus(options) {
  const { basePaths, items } = await discover({ extraPaths: options.extraPath });
  const selected = filterItems(items, { profile: options.profile, includeHistory: options.includeHistory });

  console.log(`Platform: ${basePaths.platform}`);
  console.log(`Claude Code home: ${basePaths.claudeCode}`);
  console.log(`Claude Desktop home: ${basePaths.claudeDesktop}\n`);

  if (selected.length === 0) {
    console.log('Nothing detected with the current profile/flags.');
    return;
  }

  const byCategory = new Map();
  for (const item of selected) {
    if (!byCategory.has(item.category)) byCategory.set(item.category, []);
    byCategory.get(item.category).push(item);
  }

  for (const [category, catItems] of byCategory) {
    console.log(`${category}:`);
    for (const item of catItems) {
      const flag = item.sensitive ? '[sensitive]' : '           ';
      console.log(`  ${flag} ${item.label.padEnd(40)} ${formatSize(item.size)}`);
    }
    console.log('');
  }

  console.log(`${selected.length} item(s) detected, ${selected.filter((i) => i.sensitive).length} sensitive.`);
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
