/**
 * Checks if a path should be ignored based on ignore patterns.
 * Supports exact matches and wildcard patterns (*, **).
 *
 * @param path - The route path to check
 * @param ignorePatterns - Array of patterns to ignore
 * @returns true if the path should be ignored
 */
export function shouldIgnorePath(path: string, ignorePatterns: string[]): boolean {
  for (const pattern of ignorePatterns) {
    if (matchesPattern(path, pattern)) {
      return true;
    }
  }
  return false;
}

/**
 * Matches a path against a pattern with wildcard support.
 *
 * @param path - The path to match
 * @param pattern - The pattern (supports wildcards: single-star and double-star)
 * @returns true if the path matches the pattern
 */
export function matchesPattern(path: string, pattern: string): boolean {
  // Exact match
  if (path === pattern) {
    return true;
  }

  // Convert glob pattern to regex
  // Escape special regex characters except * and /
  let regexPattern = pattern
    .replace(/[.+?^$()|\\]/g, '\\$&')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    // Replace ** with a placeholder
    .replace(/\*\*/g, '__DOUBLE_STAR__')
    // Replace * with [^/]* (match anything except /)
    .replace(/\*/g, '[^/]*')
    // Replace ** placeholder with .* (match anything including /)
    .replace(/__DOUBLE_STAR__/g, '.*');

  // Ensure the pattern matches the full path
  regexPattern = '^' + regexPattern + '$';

  const regex = new RegExp(regexPattern);
  return regex.test(path);
}
