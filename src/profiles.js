/**
 * Categories an item can belong to (see discovery/rules.js). `--profile`
 * selects which of these end up in the backup; history/cache-like
 * categories are opt-in even under `all` because they're large and
 * rarely what you want when migrating devices.
 */
export const ALL_CATEGORIES = [
  'settings',
  'skills',
  'plugins',
  'credentials',
  'desktop',
  'skills-external',
  'history',
];

export const DEFAULT_PROFILE = ALL_CATEGORIES.filter((c) => c !== 'history');

/**
 * Resolves the --profile / --include-history flags into a concrete set
 * of categories to keep, then filters discovered items.
 */
export function filterItems(items, { profile, includeHistory } = {}) {
  let categories = profile && profile.length > 0 ? profile : DEFAULT_PROFILE;

  if (includeHistory && !categories.includes('history')) {
    categories = [...categories, 'history'];
  }

  return items.filter((item) => categories.includes(item.category));
}
