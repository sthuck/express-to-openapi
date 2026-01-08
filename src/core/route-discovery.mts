import { SourceFile, Node, SyntaxKind, CallExpression } from 'ts-morph';
import { RouteInfo, HttpMethod } from '../types/internal.mjs';
import { isExpressApp, isRouter } from '../ast/express-checker.mjs';
import { resolveHandler } from '../ast/function-resolver.mjs';
import { composePath } from '../utils/path-composer.mjs';

const HTTP_METHODS: HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete'];

export function discoverRoutes(sourceFile: SourceFile): RouteInfo[] {
  const routes: RouteInfo[] = [];

  const appVariable = findExpressApp(sourceFile);
  if (!appVariable) {
    return routes;
  }

  const appName = appVariable.getName();

  discoverRoutesOnApp(sourceFile, appName, '', routes);

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

function discoverRoutesOnApp(
  sourceFile: SourceFile,
  appOrRouterName: string,
  basePath: string,
  routes: RouteInfo[],
): void {
  const callExpressions = sourceFile.getDescendantsOfKind(
    SyntaxKind.CallExpression,
  );

  for (const callExpr of callExpressions) {
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
        discoverRoutesOnApp(sourceFile, mount.routerName, newBasePath, routes);
      }
    }
  }
}

function extractRouterMount(
  callExpr: CallExpression,
  sourceFile: SourceFile,
): { mountPath: string; routerName: string } | null {
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

  const routerVar = sourceFile
    .getVariableDeclarations()
    .find((v) => v.getName() === routerName);

  if (!routerVar || !isRouter(routerVar)) {
    return null;
  }

  return { mountPath, routerName };
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
