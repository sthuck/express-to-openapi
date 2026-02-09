import { Node, Type, Symbol as TsSymbol } from "ts-morph";
import { RequestTypeInfo, TypeInfo } from "../types/internal.mjs";

/**
 * Extracts type information from an Express request handler's Request generic parameters.
 *
 * Parses the first parameter of a handler function (typically `req`) and extracts
 * type information from the Express `Request<PathParams, ResBody, ReqBody, ReqQuery>` generic.
 *
 * @param node - A function node (FunctionDeclaration, ArrowFunction, or FunctionExpression)
 * @returns RequestTypeInfo containing extracted types for path, response, body, and query params,
 *          or null if the node is not a valid handler or lacks Request type annotation
 *
 * @example
 * // For handler: (req: Request<{ id: string }, User, CreateUserBody, { page: number }>, res: Response) => {}
 * // Returns: {
 * //   pathParams: { isNamed: false, typeText: "{ id: string }" },
 * //   responseBody: { isNamed: true, typeName: "User" },
 * //   bodyParams: { isNamed: true, typeName: "CreateUserBody" },
 * //   queryParams: { isNamed: false, typeText: "{ page: number }" }
 * // }
 */
export function extractRequestTypes(node: Node): RequestTypeInfo | null {
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
  if (typeNameText !== "Request") {
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
  // ResBody: index 1
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

  // Extract response body (index 1)
  if (typeArgs.length > 1) {
    const responseBodyType = typeArgs[1];
    const typeInfo = extractTypeInfo(responseBodyType);
    if (typeInfo && !isEmptyObject(responseBodyType)) {
      result.responseBody = typeInfo;
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

/**
 * TypeScript utility types that require semantic resolution via typeChecker.
 * These types cannot be extracted via AST alone since they transform their input types.
 */
const UTILITY_TYPES = new Set([
  'Partial', 'Required', 'Readonly', 'Pick', 'Omit',
  'Record', 'Extract', 'Exclude', 'NonNullable',
]);

/**
 * Checks if a type name is a TypeScript utility type that requires semantic resolution.
 *
 * @param typeName - The name of the type to check
 * @returns true if the type is a utility type (Partial, Pick, Omit, etc.)
 */
function isUtilityType(typeName: string): boolean {
  return UTILITY_TYPES.has(typeName);
}

/**
 * Expands a TypeScript type to its structural representation using the typeChecker.
 *
 * This function resolves complex types (utility types, z.infer, intersections, etc.)
 * to their actual structure by iterating over the type's properties.
 *
 * @param type - The resolved Type from ts-morph's typeChecker
 * @param typeNode - The AST node for context (used for getting property types)
 * @returns A string representation of the type in TypeScript object literal syntax,
 *          e.g., "{ name: string; age?: number }"
 *
 * @example
 * // For Partial<User> where User = { name: string; age: number }
 * // Returns: "{ name?: string; age?: number }"
 *
 * @example
 * // For z.infer<typeof UserSchema>
 * // Returns the resolved structure: "{ name: string; email: string; role: "admin" | "user" }"
 */
export function expandTypeToStructure(type: Type, typeNode: Node): string {
  // For types with properties, build the structural representation
  const properties = type.getProperties();

  if (properties.length === 0) {
    // Fallback to getText for types without properties (primitives, etc.)
    return type.getText(typeNode);
  }

  const memberTexts = properties.map((prop: TsSymbol) => {
    const propName = prop.getName();
    const propType = prop.getTypeAtLocation(typeNode);
    const isOptional = prop.isOptional();
    const optionalMarker = isOptional ? '?' : '';
    return `${propName}${optionalMarker}: ${propType.getText(typeNode)}`;
  });

  return `{ ${memberTexts.join('; ')} }`;
}

/**
 * Extracts type information from a type node, classifying it as named or inline.
 *
 * Handles various TypeScript type constructs:
 * - **Named types** (TypeReference): Returns `isNamed: true` for use with `$ref` in OpenAPI
 * - **Utility types** (Partial, Pick, etc.): Resolves to structural form via typeChecker
 * - **Type literals**: Inline object types like `{ id: string }`
 * - **Array types**: Like `User[]` or `Array<User>`
 * - **Union types**: Like `string | number`
 * - **Intersection types**: Like `BaseUser & AdminPermissions`, resolved to merged structure
 *
 * @param typeNode - The AST node representing the type
 * @returns TypeInfo with classification and type text, or null if extraction fails
 *
 * @example
 * // Named type: UserParams
 * // Returns: { isNamed: true, typeName: "UserParams", typeNode }
 *
 * @example
 * // Inline type: { id: string }
 * // Returns: { isNamed: false, typeText: "{ id: string }", typeNode }
 *
 * @example
 * // Utility type: Partial<User>
 * // Returns: { isNamed: false, typeText: "{ name?: string; ... }", resolvedTypeText: "...", typeNode }
 */
function extractTypeInfo(typeNode: Node): TypeInfo | null {
  // Check if it's a type reference (named type like UserParams)
  if (Node.isTypeReference(typeNode)) {
    const typeName = typeNode.getTypeName().getText();

    // Utility types need semantic resolution to structural form
    if (isUtilityType(typeName)) {
      const type = typeNode.getType();
      const resolvedText = expandTypeToStructure(type, typeNode);
      return {
        isNamed: false,
        typeText: resolvedText,
        resolvedTypeText: resolvedText,
        typeNode,
      };
    }

    // Regular named types (for $ref)
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

  // Check if it's an array type (like User[] or Array<User>)
  if (Node.isArrayTypeNode(typeNode)) {
    const typeText = typeNode.getText();
    return {
      isNamed: false,
      typeText,
      typeNode,
    };
  }

  // Handle union types (e.g., string | number)
  if (Node.isUnionTypeNode(typeNode)) {
    const resolvedText = typeNode.getType().getText(typeNode);
    return {
      isNamed: false,
      typeText: resolvedText,
      resolvedTypeText: resolvedText,
      typeNode,
    };
  }

  // Handle intersection types (e.g., BaseUser & AdminPermissions)
  if (Node.isIntersectionTypeNode(typeNode)) {
    const type = typeNode.getType();
    const resolvedText = expandTypeToStructure(type, typeNode);
    return {
      isNamed: false,
      typeText: resolvedText,
      resolvedTypeText: resolvedText,
      typeNode,
    };
  }

  // Fallback: use typeChecker for any other type
  const type = typeNode.getType();
  const text = type.getText(typeNode);
  if (text && text !== 'any' && text !== 'unknown') {
    return {
      isNamed: false,
      typeText: text,
      resolvedTypeText: text,
      typeNode,
    };
  }

  return null;
}

/**
 * Checks if a type node represents an empty object type `{}`.
 *
 * Empty objects are commonly used as placeholders in Express Request generics
 * when a particular type parameter is not needed (e.g., `Request<{}, {}, Body>`).
 *
 * @param typeNode - The AST node to check
 * @returns true if the node is a type literal with no members
 *
 * @example
 * // For type `{}` returns true
 * // For type `{ id: string }` returns false
 */
function isEmptyObject(typeNode: Node): boolean {
  if (Node.isTypeLiteral(typeNode)) {
    const members = typeNode.getMembers();
    return members.length === 0;
  }
  return false;
}
