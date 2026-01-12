import {
  CallExpression,
  Node,
  SyntaxKind,
  ArrowFunction,
  FunctionExpression,
  FunctionDeclaration,
  ParameterDeclaration,
} from 'ts-morph';
import { followImport } from './import-follower.mjs';

export interface ResolvedHandler {
  node: ArrowFunction | FunctionExpression | FunctionDeclaration;
  kind: SyntaxKind;
  name?: string;
}

/**
 * List of known wrapper function names that should be unwrapped
 * to get to the actual handler. Common patterns in Express apps.
 */
const DEFAULT_WRAPPER_NAMES = [
  'asyncHandler',
  'catchAsync',
  'wrapAsync',
  'authMiddleware',
  'authenticate',
  'authorize',
  'validate',
  'withAuth',
  'tryCatch',
];

export function resolveHandler(
  callExpression: CallExpression,
  wrapperNames: string[] = DEFAULT_WRAPPER_NAMES,
): ResolvedHandler | null {
  const args = callExpression.getArguments();

  if (args.length === 0) {
    return null;
  }

  const functionArgs = args.filter(isFunctionLike);

  if (functionArgs.length === 0) {
    return null;
  }

  const lastArg = functionArgs[functionArgs.length - 1];

  return unwrapAndResolve(lastArg, wrapperNames);
}

function isFunctionLike(node: Node): boolean {
  const kind = node.getKind();
  return (
    kind === SyntaxKind.ArrowFunction ||
    kind === SyntaxKind.FunctionExpression ||
    kind === SyntaxKind.Identifier ||
    kind === SyntaxKind.CallExpression
  );
}

/**
 * Check if a CallExpression is calling a known wrapper function
 */
function isWrapperCall(
  callExpr: CallExpression,
  wrapperNames: string[],
): boolean {
  const expression = callExpr.getExpression();

  if (Node.isIdentifier(expression)) {
    const functionName = expression.getText();
    return wrapperNames.includes(functionName);
  }

  return false;
}

/**
 * Unwrap handler wrappers and resolve to the actual handler function
 * Recursively unwraps nested wrappers (e.g., authMiddleware(asyncHandler(handler)))
 */
function unwrapAndResolve(
  node: Node,
  wrapperNames: string[],
  depth: number = 0,
): ResolvedHandler | null {
  // Prevent infinite recursion
  const MAX_DEPTH = 10;
  if (depth > MAX_DEPTH) {
    return null;
  }

  const kind = node.getKind();

  // If it's a CallExpression, check if it's a wrapper
  if (kind === SyntaxKind.CallExpression) {
    const callExpr = node as CallExpression;

    if (isWrapperCall(callExpr, wrapperNames)) {
      // Get the first argument (the wrapped function)
      const args = callExpr.getArguments();
      if (args.length > 0) {
        const wrappedArg = args[0];
        // Recursively unwrap
        return unwrapAndResolve(wrappedArg, wrapperNames, depth + 1);
      }
    }

    // If not a wrapper, treat as an error (unexpected CallExpression)
    return null;
  }

  // Otherwise, resolve as a normal function node
  return resolveFunctionNode(node);
}

function resolveFunctionNode(node: Node): ResolvedHandler | null {
  const kind = node.getKind();

  if (kind === SyntaxKind.ArrowFunction) {
    return {
      node: node as ArrowFunction,
      kind: SyntaxKind.ArrowFunction,
    };
  }

  if (kind === SyntaxKind.FunctionExpression) {
    const funcExpr = node as FunctionExpression;
    return {
      node: funcExpr,
      kind: SyntaxKind.FunctionExpression,
      name: funcExpr.getName(),
    };
  }

  if (kind === SyntaxKind.Identifier) {
    const definitions = node.asKind(SyntaxKind.Identifier)!.getDefinitions();

    for (const def of definitions) {
      const declNode = def.getDeclarationNode();

      if (!declNode) continue;

      if (Node.isFunctionDeclaration(declNode)) {
        return {
          node: declNode,
          kind: SyntaxKind.FunctionDeclaration,
          name: declNode.getName(),
        };
      }

      if (Node.isVariableDeclaration(declNode)) {
        const initializer = declNode.getInitializer();
        if (initializer) {
          if (Node.isArrowFunction(initializer)) {
            return {
              node: initializer,
              kind: SyntaxKind.ArrowFunction,
              name: declNode.getName(),
            };
          }
          if (Node.isFunctionExpression(initializer)) {
            return {
              node: initializer,
              kind: SyntaxKind.FunctionExpression,
              name: declNode.getName(),
            };
          }
        }
      }
    }
  }

  return null;
}

/**
 * Resolves a function call expression to its function definition
 * Follows imports if the function is defined in another file
 */
export function resolveFunctionDefinition(
  callExpression: CallExpression,
): FunctionDeclaration | ArrowFunction | FunctionExpression | null {
  const expression = callExpression.getExpression();

  if (Node.isIdentifier(expression)) {
    const definitions = expression.getDefinitions();

    for (const def of definitions) {
      const declNode = def.getDeclarationNode();
      if (!declNode) continue;

      if (Node.isFunctionDeclaration(declNode)) {
        return declNode;
      }

      if (Node.isVariableDeclaration(declNode)) {
        const initializer = declNode.getInitializer();
        if (Node.isArrowFunction(initializer)) return initializer;
        if (Node.isFunctionExpression(initializer)) return initializer;
      }
    }

    // Follow imports
    const importedDef = followImport(expression);
    if (importedDef) {
      if (Node.isFunctionDeclaration(importedDef)) {
        return importedDef;
      }
      if (Node.isVariableDeclaration(importedDef)) {
        const initializer = importedDef.getInitializer();
        if (Node.isArrowFunction(initializer)) return initializer;
        if (Node.isFunctionExpression(initializer)) return initializer;
      }
    }
  }

  return null;
}

/**
 * Gets the parameter name at a specific index in a function
 */
export function getParameterNameAtIndex(
  functionNode: FunctionDeclaration | ArrowFunction | FunctionExpression,
  index: number,
): string | null {
  const params = functionNode.getParameters();
  if (index >= params.length) return null;

  const param = params[index];
  if (Node.isParameterDeclaration(param)) {
    return param.getName();
  }

  return null;
}
