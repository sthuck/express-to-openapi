import { Node, FunctionDeclaration, ArrowFunction, SyntaxKind } from 'ts-morph';
import { RequestTypeInfo, TypeInfo } from '../types/internal.mjs';

export function extractRequestTypes(
  node: Node,
): RequestTypeInfo | null {
  // Handle both FunctionDeclaration and ArrowFunction
  if (
    !Node.isFunctionDeclaration(node) &&
    !Node.isArrowFunction(node) &&
    !Node.isFunctionExpression(node)
  ) {
    return null;
  }

  const params = node.getParameters();
  if (params.length === 0) {
    return null;
  }

  // Get the first parameter (typically 'req')
  const reqParam = params[0];
  const typeNode = reqParam.getTypeNode();

  if (!typeNode) {
    return null;
  }

  // Check if it's a type reference (e.g., Request<...>)
  if (!Node.isTypeReference(typeNode)) {
    return null;
  }

  const typeName = typeNode.getTypeName();
  const typeNameText = typeName.getText();

  // Check if it's the Request type
  if (typeNameText !== 'Request') {
    return null;
  }

  const typeArgs = typeNode.getTypeArguments();

  if (typeArgs.length === 0) {
    // Request without generics
    return {};
  }

  const result: RequestTypeInfo = {};

  // Request<PathParams, ResBody, ReqBody, ReqQuery, Locals>
  // PathParams: index 0
  // ReqBody: index 2
  // ReqQuery: index 3

  // Extract path params (index 0)
  if (typeArgs.length > 0) {
    const pathParamType = typeArgs[0];
    const typeInfo = extractTypeInfo(pathParamType);
    if (typeInfo && !isEmptyObject(pathParamType)) {
      result.pathParams = typeInfo;
    }
  }

  // Extract body params (index 2)
  if (typeArgs.length > 2) {
    const bodyParamType = typeArgs[2];
    const typeInfo = extractTypeInfo(bodyParamType);
    if (typeInfo && !isEmptyObject(bodyParamType)) {
      result.bodyParams = typeInfo;
    }
  }

  // Extract query params (index 3)
  if (typeArgs.length > 3) {
    const queryParamType = typeArgs[3];
    const typeInfo = extractTypeInfo(queryParamType);
    if (typeInfo && !isEmptyObject(queryParamType)) {
      result.queryParams = typeInfo;
    }
  }

  return result;
}

function extractTypeInfo(typeNode: Node): TypeInfo | null {
  // Check if it's a type reference (named type like UserParams)
  if (Node.isTypeReference(typeNode)) {
    const typeName = typeNode.getTypeName().getText();
    return {
      isNamed: true,
      typeName,
      typeNode,
    };
  }

  // Check if it's a type literal (inline type like { id: string })
  if (Node.isTypeLiteral(typeNode)) {
    const typeText = typeNode.getText();
    return {
      isNamed: false,
      typeText,
      typeNode,
    };
  }

  return null;
}

function isEmptyObject(typeNode: Node): boolean {
  if (Node.isTypeLiteral(typeNode)) {
    const members = typeNode.getMembers();
    return members.length === 0;
  }
  return false;
}
