import {
  CallExpression,
  Node,
  SyntaxKind,
  ArrowFunction,
  FunctionExpression,
  FunctionDeclaration,
} from 'ts-morph';

export interface ResolvedHandler {
  node: ArrowFunction | FunctionExpression | FunctionDeclaration;
  kind: SyntaxKind;
  name?: string;
}

export function resolveHandler(
  callExpression: CallExpression,
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

  return resolveFunctionNode(lastArg);
}

function isFunctionLike(node: Node): boolean {
  const kind = node.getKind();
  return (
    kind === SyntaxKind.ArrowFunction ||
    kind === SyntaxKind.FunctionExpression ||
    kind === SyntaxKind.Identifier
  );
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
