const SENSITIVE_KEY_PATTERN = /(api[_-]?key|token|secret|password|credential|access[_-]?key|private[_-]?key)/i;

/**
 * Walks a parsed JSON value looking for keys that look like they hold a
 * credential. Used to catch cases the static rule catalog can't predict,
 * e.g. an MCP server entry with an inline API key inside settings.json.
 * Returns true on first match (we don't need to know how many).
 */
export function containsSensitiveKeys(value, depth = 0) {
  if (depth > 12 || value === null || typeof value !== 'object') return false;

  for (const [key, val] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key) && typeof val === 'string' && val.length > 0) {
      return true;
    }
    if (typeof val === 'object' && containsSensitiveKeys(val, depth + 1)) {
      return true;
    }
  }
  return false;
}

/**
 * Best-effort: try to parse a file's contents as JSON and check it for
 * embedded secrets. Non-JSON or unreadable files are treated as clean
 * (their static `sensitive` flag from the catalog still applies).
 */
export function fileLooksSensitive(rawText) {
  try {
    const parsed = JSON.parse(rawText);
    return containsSensitiveKeys(parsed);
  } catch {
    return false;
  }
}
