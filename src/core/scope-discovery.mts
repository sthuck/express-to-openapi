import { SourceFile, Node, SyntaxKind, CallExpression } from 'ts-morph';
import { RouteInfo, HttpMethod } from '../types/internal.mjs';
import { isRouter } from '../ast/express-checker.mjs';
import {
  resolveHandler,
  resolveFunctionDefinition,
  getParameterNameAtIndex,
  WrapperConfig,
} from '../ast/function-resolver.mjs';
import { composePath } from '../utils/path-composer.mjs';
import { followImport } from '../ast/import-follower.mjs';
import { debug } from '../utils/logger.mjs';

export interface ScopeDiscoveryOptions {
  /** Regex patterns to match wrapper function names */
  wrapperPatterns?: RegExp[];
}

const HTTP_METHODS: HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete'];

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
 * Check if a method name is an HTTP method
 */
function isHttpMethod(name: string): boolean {
  return HTTP_METHODS.includes(name as HttpMethod);
}

/**
 * Find all function calls that pass the app/router as an argument
 */
function findFunctionCallsWithApp(
  _sourceFile: SourceFile,
  appOrRouterName: string,
  callExpressions: CallExpression[],
): Array<{ callExpr: CallExpression; argIndex: number }> {
  const results: Array<{ callExpr: CallExpression; argIndex: number }> = [];

  debug(`Searching for function calls that pass "${appOrRouterName}" as argument`, {
    totalCallExpressions: callExpressions.length,
  });

  for (const callExpr of callExpressions) {
    const args = callExpr.getArguments();
    const callText = callExpr.getText().substring(0, 60);

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const argText = arg.getText();

      if (Node.isIdentifier(arg) && argText === appOrRouterName) {
        debug(`✓ Found function call passing "${appOrRouterName}"`, {
          call: callText,
          argIndex: i,
          totalArgs: args.length,
        });
        results.push({ callExpr, argIndex: i });
        break;
      }
    }
  }

  if (results.length === 0) {
    debug(`✗ No function calls found passing "${appOrRouterName}"`);
  }

  return results;
}

/**
 * Process function calls that pass the app/router as an argument
 */
function processFunctionCallsWithApp(
  scope: Node,
  sourceFile: SourceFile,
  appOrRouterName: string,
  basePath: string,
  callExpressions: CallExpression[],
  routes: RouteInfo[],
  visitedFunctions: Set<string>,
  options?: ScopeDiscoveryOptions,
): void {
  const scopeType = Node.isSourceFile(scope) ? 'file' : 'function';
  const functionCalls = findFunctionCallsWithApp(
    sourceFile,
    appOrRouterName,
    callExpressions,
  );

  if (functionCalls.length > 0) {
    debug(`Found ${functionCalls.length} function calls passing ${appOrRouterName}`, {
      scope: scopeType,
    });
  }

  for (const { callExpr, argIndex } of functionCalls) {
    const callText = callExpr.getText().substring(0, 80);
    const callExpression = callExpr.getExpression().getText();

    debug('Attempting to resolve function definition', {
      callExpression: callExpression,
      callText: callText,
      argIndex,
    });

    const functionDef = resolveFunctionDefinition(callExpr);
    if (!functionDef) {
      debug('✗ Could not resolve function definition', {
        expression: callExpression,
        possibleReasons:
          'Not a function reference, complex expression, or definition not found',
      });
      continue;
    }

    const functionKind = functionDef.getKindName();
    const functionText = functionDef.getText().substring(0, 150);

    debug('✓ Resolved function definition', {
      kind: functionKind,
      preview: functionText,
      location: `${functionDef.getSourceFile().getFilePath()}:${functionDef.getStartLineNumber()}`,
    });

    // Check for infinite recursion
    const functionKey = getFunctionKey(functionDef);
    if (visitedFunctions.has(functionKey)) {
      debug('⚠ Skipping already visited function (recursion prevention)', {
        functionKey,
        kind: functionKind,
      });
      continue;
    }

    visitedFunctions.add(functionKey);

    // Get parameter name
    const params = functionDef.getParameters();
    debug(`Function has ${params.length} parameters`, {
      parameters: params.map((p) => p.getText()).join(', '),
      targetIndex: argIndex,
    });

    const paramName = getParameterNameAtIndex(functionDef, argIndex);
    if (!paramName) {
      debug('✗ Could not get parameter name at index', {
        argIndex,
        totalParams: params.length,
      });
      continue;
    }

    debug('✓ Extracted parameter name', {
      parameterName: paramName,
      fromExpression: `${callExpression}(..., arg[${argIndex}], ...)`,
    });

    debug('➜ Following function call into body', {
      functionExpression: callExpression,
      parameterName: paramName,
      argIndex,
      targetFile: functionDef.getSourceFile().getFilePath(),
      targetLine: functionDef.getStartLineNumber(),
    });

    // Recurse into function body with parameter name
    const functionSourceFile = functionDef.getSourceFile();
    discoverRoutesInScope(
      functionDef,
      functionSourceFile,
      paramName,
      basePath,
      routes,
      visitedFunctions,
      options,
    );
  }
}

/**
 * Extract route information from a method call (e.g., app.get('/path', handler))
 */
function extractRoute(
  callExpr: CallExpression,
  method: HttpMethod,
  basePath: string,
  options?: ScopeDiscoveryOptions,
): RouteInfo | null {
  const args = callExpr.getArguments();
  const callText = callExpr.getText().substring(0, 100);

  debug('Extracting route from method call', {
    method: method.toUpperCase(),
    call: callText,
    argCount: args.length,
    basePath: basePath || '/',
  });

  if (args.length < 2) {
    debug('✗ Not enough arguments for route', {
      method: method.toUpperCase(),
      expected: 'at least 2',
      received: args.length,
    });
    return null;
  }

  const pathArg = args[0];
  const pathArgText = pathArg.getText();
  const pathArgKind = pathArg.getKindName();

  debug('Checking path argument', {
    text: pathArgText,
    kind: pathArgKind,
    isStringLiteral: Node.isStringLiteral(pathArg),
  });

  if (!Node.isStringLiteral(pathArg)) {
    debug('✗ Path argument is not a string literal', {
      method: method.toUpperCase(),
      kind: pathArgKind,
      text: pathArgText,
    });
    return null;
  }

  const routePath = pathArg.getLiteralValue();
  const fullPath = composePath(basePath, routePath);

  debug('Composed full path', {
    routePath,
    basePath: basePath || '/',
    fullPath,
  });

  // Show all handler arguments
  const handlerArgs = args.slice(1);
  debug(`Found ${handlerArgs.length} handler/middleware arguments`, {
    handlers: handlerArgs.map((arg, i) => ({
      index: i + 1,
      kind: arg.getKindName(),
      text: arg.getText().substring(0, 40),
    })),
  });

  // Build wrapper config from options
  const wrapperConfig: WrapperConfig | undefined = options?.wrapperPatterns
    ? { patterns: options.wrapperPatterns }
    : undefined;

  const handler = resolveHandler(callExpr, wrapperConfig);
  if (!handler) {
    debug('✗ Could not resolve handler', {
      method: method.toUpperCase(),
      path: fullPath,
      possibleReasons: 'No function-like arguments found',
    });
    return null;
  }

  debug('✓ Resolved handler', {
    handlerKind: handler.kind,
    handlerName: handler.name || 'anonymous',
    preview: handler.node.getText().substring(0, 80),
  });

  const routeInfo = {
    path: fullPath,
    method,
    handlerName: handler.name,
    handlerNode: handler.node,
  };

  debug('✓ Successfully extracted complete route', {
    method: method.toUpperCase(),
    path: fullPath,
    handler: handler.name || 'anonymous',
  });

  return routeInfo;
}

/**
 * Extract router mount information from app.use() call
 */
function extractRouterMount(
  callExpr: CallExpression,
  sourceFile: SourceFile,
): { mountPath: string; routerName: string; routerSourceFile?: SourceFile } | null {
  const args = callExpr.getArguments();

  debug('Extracting router mount details', {
    call: callExpr.getText().substring(0, 80),
    argCount: args.length,
  });

  if (args.length === 0) {
    debug('✗ No arguments provided to app.use()', {
      expected: 'at least 1',
      received: 0,
    });
    return null;
  }

  let mountPath: string;
  let routerArg: Node;

  // Handle both app.use(router) and app.use('/path', router)
  if (args.length === 1) {
    // app.use(router) - mount at root
    debug('Single argument detected, checking if it is a router');
    mountPath = '/';
    routerArg = args[0];
  } else {
    // app.use('/path', router) - mount at specified path
    const pathArg = args[0];
    const pathArgText = pathArg.getText();
    const pathArgKind = pathArg.getKindName();

    debug('Checking path argument', {
      text: pathArgText,
      kind: pathArgKind,
      isStringLiteral: Node.isStringLiteral(pathArg),
    });

    if (!Node.isStringLiteral(pathArg)) {
      debug('✗ Path argument is not a string literal', {
        kind: pathArgKind,
      });
      return null;
    }

    mountPath = pathArg.getLiteralValue();
    routerArg = args[1];
  }

  const routerArgText = routerArg.getText();
  const routerArgKind = routerArg.getKindName();

  debug('Checking router argument', {
    text: routerArgText,
    kind: routerArgKind,
    isIdentifier: Node.isIdentifier(routerArg),
  });

  if (!Node.isIdentifier(routerArg)) {
    debug('✗ Router argument is not an identifier', {
      kind: routerArgKind,
    });
    return null;
  }

  const routerName = routerArg.getText();

  debug('Extracted mount details', {
    mountPath,
    routerName,
  });

  // First, check if router is defined locally in the same file
  debug(`Looking for router "${routerName}" in local file`, {
    file: sourceFile.getFilePath(),
  });

  const routerVar = sourceFile
    .getVariableDeclarations()
    .find((v) => v.getName() === routerName);

  if (routerVar) {
    const routerVarText = routerVar.getText().substring(0, 100);
    debug('Found local variable with matching name', {
      name: routerName,
      declaration: routerVarText,
      isRouter: isRouter(routerVar),
    });

    if (isRouter(routerVar)) {
      debug('✓ Verified as Express Router', {
        routerName,
        location: 'local file',
      });
      return { mountPath, routerName };
    }
  } else {
    debug('Router not found locally, checking imports');
  }

  // If not found locally, check if it's imported
  debug(`Following import for "${routerName}"`);
  const importedDefinition = followImport(routerArg);

  if (importedDefinition) {
    const importedKind = importedDefinition.getKindName();
    const importedText = importedDefinition.getText().substring(0, 100);

    debug('Found imported definition', {
      kind: importedKind,
      preview: importedText,
      isVariableDeclaration: Node.isVariableDeclaration(importedDefinition),
    });

    if (Node.isVariableDeclaration(importedDefinition)) {
      const isRouterCheck = isRouter(importedDefinition);
      debug('Checking if imported variable is a router', {
        isRouter: isRouterCheck,
      });

      if (isRouterCheck) {
        const importedSourceFile = importedDefinition.getSourceFile();
        debug('✓ Verified as imported Express Router', {
          routerName: importedDefinition.getName(),
          importedFrom: importedSourceFile.getFilePath(),
        });
        return {
          mountPath,
          routerName: importedDefinition.getName(),
          routerSourceFile: importedSourceFile,
        };
      }
    }
  } else {
    debug('✗ Could not follow import', {
      routerName,
    });
  }

  debug('✗ Router not found or not valid Express Router', {
    routerName,
  });
  return null;
}

/**
 * Process a single HTTP method call (GET, POST, etc.)
 */
function processHttpMethodCall(
  callExpr: CallExpression,
  methodName: string,
  basePath: string,
  routes: RouteInfo[],
  options?: ScopeDiscoveryOptions,
): void {
  const callText = callExpr.getText().substring(0, 100);

  debug(`Processing HTTP method: ${methodName.toUpperCase()}`, {
    call: callText,
  });

  const route = extractRoute(callExpr, methodName as HttpMethod, basePath, options);
  if (route) {
    debug('✓ Successfully extracted route', {
      method: methodName.toUpperCase(),
      path: route.path,
      handler: route.handlerName || 'anonymous',
      handlerKind: route.handlerNode.getKindName(),
    });
    routes.push(route);
  } else {
    debug('✗ Failed to extract route', {
      method: methodName.toUpperCase(),
      call: callText,
      reason: 'Missing path or handler',
    });
  }
}

/**
 * Process a single router mount (app.use)
 */
function processRouterMount(
  callExpr: CallExpression,
  sourceFile: SourceFile,
  basePath: string,
  routes: RouteInfo[],
  visitedFunctions: Set<string>,
  options?: ScopeDiscoveryOptions,
): void {
  const callText = callExpr.getText().substring(0, 100);

  debug('Processing router mount with app.use()', {
    call: callText,
  });

  const mount = extractRouterMount(callExpr, sourceFile);
  if (mount) {
    const newBasePath = composePath(basePath, mount.mountPath);
    debug('✓ Successfully extracted router mount', {
      mountPath: mount.mountPath,
      routerName: mount.routerName,
      newBasePath,
      targetFile:
        mount.routerSourceFile?.getFilePath() || sourceFile.getFilePath(),
      imported: !!mount.routerSourceFile,
    });

    // If router is imported from another file, discover routes in that file
    const targetSourceFile = mount.routerSourceFile || sourceFile;
    debug('➜ Recursing into mounted router', {
      routerName: mount.routerName,
      basePath: newBasePath,
    });

    discoverRoutesInScope(
      targetSourceFile,
      targetSourceFile,
      mount.routerName,
      newBasePath,
      routes,
      visitedFunctions,
      options,
    );
  } else {
    debug('✗ Failed to extract router mount', {
      call: callText,
      reason: 'Could not resolve router or missing mount path',
    });
  }
}

/**
 * Process all route method calls in the scope
 */
function processRouteMethodCalls(
  scope: Node,
  sourceFile: SourceFile,
  appOrRouterName: string,
  basePath: string,
  callExpressions: CallExpression[],
  routes: RouteInfo[],
  visitedFunctions: Set<string>,
  options?: ScopeDiscoveryOptions,
): void {
  debug('Starting route method call discovery', {
    appOrRouterName,
    basePath: basePath || '/',
  });

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
    const callText = callExpr.getText().substring(0, 100);

    debug(`Examining ${obj}.${methodName}() call`, {
      callPreview: callText,
    });

    if (isHttpMethod(methodName)) {
      processHttpMethodCall(callExpr, methodName, basePath, routes, options);
    } else if (methodName === 'use') {
      processRouterMount(
        callExpr,
        sourceFile,
        basePath,
        routes,
        visitedFunctions,
        options,
      );
    } else {
      debug(`Skipping non-route method: ${methodName}`, {
        call: callText,
      });
    }
  }
}

/**
 * Discover routes in a specific scope (file or function)
 */
export function discoverRoutesInScope(
  scope: Node,
  sourceFile: SourceFile,
  appOrRouterName: string,
  basePath: string,
  routes: RouteInfo[],
  visitedFunctions: Set<string> = new Set(),
  options?: ScopeDiscoveryOptions,
): void {
  const scopeType = Node.isSourceFile(scope) ? 'file' : 'function';
  const scopeIdentifier = Node.isSourceFile(scope)
    ? scope.getFilePath()
    : `${scope.getKindName()} at ${scope.getSourceFile().getFilePath()}:${scope.getStartLineNumber()}`;

  debug('Discovering routes in scope', {
    scope: scopeType,
    identifier: scopeIdentifier,
    appOrRouterName,
    basePath: basePath || '/',
  });

  const callExpressions = scope.getDescendantsOfKind(
    SyntaxKind.CallExpression,
  );

  debug(`Found ${callExpressions.length} call expressions in scope`, {
    scope: scopeType,
  });

  // Process function calls first (before route discovery)
  processFunctionCallsWithApp(
    scope,
    sourceFile,
    appOrRouterName,
    basePath,
    callExpressions,
    routes,
    visitedFunctions,
    options,
  );

  // Process route method calls
  processRouteMethodCalls(
    scope,
    sourceFile,
    appOrRouterName,
    basePath,
    callExpressions,
    routes,
    visitedFunctions,
    options,
  );

  debug('Finished route discovery in scope', {
    scope: scopeType,
    routesDiscoveredInScope: routes.length,
  });
}
