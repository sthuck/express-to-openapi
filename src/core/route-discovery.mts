import { SourceFile } from 'ts-morph';
import { RouteInfo } from '../types/internal.mjs';
import { isExpressApp } from '../ast/express-checker.mjs';
import { debug } from '../utils/logger.mjs';
import { discoverRoutesInScope } from './scope-discovery.mjs';

export function discoverRoutes(sourceFile: SourceFile): RouteInfo[] {
  const routes: RouteInfo[] = [];
  const filePath = sourceFile.getFilePath();

  debug('Starting route discovery', { file: filePath });

  const appVariable = findExpressApp(sourceFile);
  if (!appVariable) {
    debug('No Express app found in file', { file: filePath });
    return routes;
  }

  const appName = appVariable.getName();
  debug('Found Express app', { file: filePath, appName });

  discoverRoutesOnApp(sourceFile, appName, '', routes, new Set());

  debug('Route discovery complete', {
    file: filePath,
    routesFound: routes.length,
  });

  return routes;
}

function findExpressApp(sourceFile: SourceFile) {
  const variables = sourceFile.getVariableDeclarations();

  debug(`Checking ${variables.length} variable declarations for Express app`, {
    file: sourceFile.getFilePath(),
  });

  for (const variable of variables) {
    const varName = variable.getName();
    const initializer = variable.getInitializer();
    const initText = initializer ? initializer.getText().substring(0, 50) : 'none';

    debug('Examining variable declaration', {
      name: varName,
      initializer: initText,
    });

    if (isExpressApp(variable)) {
      debug('✓ Found Express app variable', {
        name: varName,
        declaration: variable.getText().substring(0, 100),
      });
      return variable;
    }
  }

  debug('✗ No Express app found in any variable declarations');
  return null;
}

function discoverRoutesOnApp(
  sourceFile: SourceFile,
  appOrRouterName: string,
  basePath: string,
  routes: RouteInfo[],
  visitedFunctions: Set<string> = new Set(),
): void {
  discoverRoutesInScope(
    sourceFile,
    sourceFile,
    appOrRouterName,
    basePath,
    routes,
    visitedFunctions,
  );
}
