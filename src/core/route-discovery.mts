import { SourceFile, Node, SyntaxKind, CallExpression } from 'ts-morph';
import { RouteInfo, HttpMethod } from '../types/internal.mjs';
import { isExpressApp, isRouter } from '../ast/express-checker.mjs';
import {
  resolveHandler,
  resolveFunctionDefinition,
  getParameterNameAtIndex,
} from '../ast/function-resolver.mjs';
import { composePath } from '../utils/path-composer.mjs';
import { followImport } from '../ast/import-follower.mjs';

const HTTP_METHODS: HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete'];

export function discoverRoutes(sourceFile: SourceFile): RouteInfo[] {
  const routes: RouteInfo[] = [];

  const appVariable = findExpressApp(sourceFile);
  if (!appVariable) {
    return routes;
  }

  const appName = appVariable.getName();

  discoverRoutesOnApp(sourceFile, appName, '', routes, new Set());

  return routes;
}

function findExpressApp(sourceFile: SourceFile) {
  const variables = sourceFile.getVariableDeclarations();

  for (const variable of variables) {
    if (isExpressApp(variable)) {
      return variable;
    }
  }

  return null;
}

/**
 * Generate unique key for a function to prevent infinite recursion
 */
function getFunctionKey(node: Node): string {
  const sourceFile = node.getSourceFile();
  const filePath = sourceFile.getFilePath();
  const position = node.getPos();
  return `${filePath}:${position}`;
}

/**
 * Check if a call expression is inside a function body
 * (not at the scope level we're currently processing)
 */
function isInsideFunctionBody(callExpr: CallExpression, scope: Node): boolean {
  let current = callExpr.getParent();

  while (current && current !== scope) {
    if (
      Node.isFunctionDeclaration(current) ||
      Node.isFunctionExpression(current) ||
      Node.isArrowFunction(current)
    ) {
      return true;
    }
    current = current.getParent();
  }

  return false;
}

/**
 * Find all function calls that pass the app/router as an argument
 */
function findFunctionCallsWithApp(
  sourceFile: SourceFile,
  appOrRouterName: string,
  callExpressions: CallExpression[],
): Array<{ callExpr: CallExpression; argIndex: number }> {
  const results: Array<{ callExpr: CallExpression; argIndex: number }> = [];

  for (const callExpr of callExpressions) {
    const args = callExpr.getArguments();

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (Node.isIdentifier(arg) && arg.getText() === appOrRouterName) {
        results.push({ callExpr, argIndex: i });
        break;
      }
    }
  }

  return results;
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

function discoverRoutesInScope(
  scope: Node,
  sourceFile: SourceFile,
  appOrRouterName: string,
  basePath: string,
  routes: RouteInfo[],
  visitedFunctions: Set<string> = new Set(),
): void {
  const callExpressions = scope.getDescendantsOfKind(
    SyntaxKind.CallExpression,
  );

  // NEW: Process function calls first (before route discovery)
  const functionCalls = findFunctionCallsWithApp(
    sourceFile,
    appOrRouterName,
    callExpressions,
  );

  for (const { callExpr, argIndex } of functionCalls) {
    const functionDef = resolveFunctionDefinition(callExpr);
    if (!functionDef) continue;

    // Check for infinite recursion
    const functionKey = getFunctionKey(functionDef);
    if (visitedFunctions.has(functionKey)) continue;

    visitedFunctions.add(functionKey);

    // Get parameter name
    const paramName = getParameterNameAtIndex(functionDef, argIndex);
    if (!paramName) continue;

    // Recurse into function body with parameter name
    const functionSourceFile = functionDef.getSourceFile();
    discoverRoutesInScope(
      functionDef,
      functionSourceFile,
      paramName,
      basePath,
      routes,
      visitedFunctions,
    );
  }

  // EXISTING: Continue with normal route discovery
  for (const callExpr of callExpressions) {
    // Skip call expressions that are inside function bodies
    // (they will be processed when we recurse into those functions)
    if (isInsideFunctionBody(callExpr, scope)) {
      continue;
    }

    const expression = callExpr.getExpression();

    if (!Node.isPropertyAccessExpression(expression)) {
      continue;
    }

    const obj = expression.getExpression().getText();
    if (obj !== appOrRouterName) {
      continue;
    }

    const methodName = expression.getName();

    if (isHttpMethod(methodName)) {
      const route = extractRoute(callExpr, methodName as HttpMethod, basePath);
      if (route) {
        routes.push(route);
      }
    } else if (methodName === 'use') {
      const mount = extractRouterMount(callExpr, sourceFile);
      if (mount) {
        const newBasePath = composePath(basePath, mount.mountPath);
        // If router is imported from another file, discover routes in that file
        const targetSourceFile = mount.routerSourceFile || sourceFile;
        discoverRoutesInScope(
          targetSourceFile,
          targetSourceFile,
          mount.routerName,
          newBasePath,
          routes,
          visitedFunctions,
        );
      }
    }
  }
}

function extractRouterMount(
  callExpr: CallExpression,
  sourceFile: SourceFile,
): { mountPath: string; routerName: string; routerSourceFile?: SourceFile } | null {
  const args = callExpr.getArguments();

  if (args.length < 2) {
    return null;
  }

  const pathArg = args[0];
  if (!Node.isStringLiteral(pathArg)) {
    return null;
  }

  const routerArg = args[1];
  if (!Node.isIdentifier(routerArg)) {
    return null;
  }

  const mountPath = pathArg.getLiteralValue();
  const routerName = routerArg.getText();

  // First, check if router is defined locally in the same file
  const routerVar = sourceFile
    .getVariableDeclarations()
    .find((v) => v.getName() === routerName);

  if (routerVar && isRouter(routerVar)) {
    return { mountPath, routerName };
  }

  // If not found locally, check if it's imported
  const importedDefinition = followImport(routerArg);

  if (importedDefinition && Node.isVariableDeclaration(importedDefinition)) {
    if (isRouter(importedDefinition)) {
      const importedSourceFile = importedDefinition.getSourceFile();
      return {
        mountPath,
        routerName: importedDefinition.getName(),
        routerSourceFile: importedSourceFile,
      };
    }
  }

  return null;
}

function isHttpMethod(name: string): boolean {
  return HTTP_METHODS.includes(name as HttpMethod);
}

function extractRoute(
  callExpr: CallExpression,
  method: HttpMethod,
  basePath: string,
): RouteInfo | null {
  const args = callExpr.getArguments();

  if (args.length < 2) {
    return null;
  }

  const pathArg = args[0];
  if (!Node.isStringLiteral(pathArg)) {
    return null;
  }

  const routePath = pathArg.getLiteralValue();
  const fullPath = composePath(basePath, routePath);

  const handler = resolveHandler(callExpr);
  if (!handler) {
    return null;
  }

  return {
    path: fullPath,
    method,
    handlerName: handler.name,
    handlerNode: handler.node,
  };
}
