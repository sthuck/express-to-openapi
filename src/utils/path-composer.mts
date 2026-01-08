export function composePath(basePath: string, routePath: string): string {
  const normalizedBase = normalizePath(basePath);
  const normalizedRoute = normalizePath(routePath);

  if (normalizedBase === '' && normalizedRoute === '') {
    return '/';
  }

  if (normalizedBase === '') {
    return normalizedRoute || '/';
  }

  if (normalizedRoute === '' || normalizedRoute === '/') {
    return normalizedBase;
  }

  return normalizedBase + normalizedRoute;
}

function normalizePath(path: string): string {
  if (!path || path === '/') {
    return '';
  }

  let normalized = path;

  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }

  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}
