import { Node, ParameterDeclaration, Type, TypeNode, TypeReferenceNode, Symbol as TsSymbol } from "ts-morph";
import { RequestTypeInfo, TypeInfo } from "../types/internal.mjs";

/**
 * Extracts type information from an Express request handler's parameters.
 *
 * Parses both the Request and Response parameters to extract type information:
 * - From `Request<PathParams, ResBody, ReqBody, ReqQuery>`: path, response, body, query params
 * - From `Response<ResBody>`: response body type
 *
 * @param node - A function node (FunctionDeclaration, ArrowFunction, or FunctionExpression)
 * @returns RequestTypeInfo containing extracted types, or null if not a valid handler
 *
 * @example
 * // For handler: (req: Request<{ id: string }, User, CreateUserBody>, res: Response) => {}
 * // Returns: {
 * //   pathParams: { isNamed: false, typeText: "{ id: string }" },
 * //   responseBody: { isNamed: true, typeName: "User" },
 * //   bodyParams: { isNamed: true, typeName: "CreateUserBody" }
 * // }
 */
export function extractRequestTypes(node: Node): RequestTypeInfo | null {
  if (!isHandlerFunction(node)) {
    return null;
  }

  const params = node.getParameters();
  if (params.length === 0) {
    return null;
  }

  const requestParam = params[0];
  const responseParam = params.length > 1 ? params[1] : null;

  const typesFromRequest = extractTypesFromRequestParam(requestParam);
  const responseTypeFromResponse = responseParam
    ? extractResponseTypeFromResponseParam(responseParam)
    : null;

  const hasAnyExpressTypes = typesFromRequest !== null || responseTypeFromResponse !== null;
  if (!hasAnyExpressTypes) {
    return null;
  }

  const result: RequestTypeInfo = typesFromRequest?.types ?? {};

  result.responseBody = mergeResponseTypes(
    result.responseBody,
    responseTypeFromResponse,
  );

  return result;
}

// =============================================================================
// Handler Function Validation
// =============================================================================

/**
 * Checks if a node is a valid Express handler function.
 */
function isHandlerFunction(node: Node): node is Node & { getParameters(): ParameterDeclaration[] } {
  return (
    Node.isFunctionDeclaration(node) ||
    Node.isArrowFunction(node) ||
    Node.isFunctionExpression(node)
  );
}

// =============================================================================
// Request Parameter Extraction
// =============================================================================

interface RequestExtractionResult {
  types: RequestTypeInfo;
}

/**
 * Extracts types from the Request parameter (typically the first param 'req').
 * Handles Request<PathParams, ResBody, ReqBody, ReqQuery, Locals>.
 */
function extractTypesFromRequestParam(
  param: ParameterDeclaration,
): RequestExtractionResult | null {
  const typeNode = param.getTypeNode();
  if (!isExpressRequestType(typeNode)) {
    return null;
  }

  const typeArgs = typeNode.getTypeArguments();
  const types: RequestTypeInfo = {};

  types.pathParams = extractTypeArgumentIfPresent(typeArgs, 0);
  types.responseBody = extractTypeArgumentIfPresent(typeArgs, 1);
  types.bodyParams = extractTypeArgumentIfPresent(typeArgs, 2);
  types.queryParams = extractTypeArgumentIfPresent(typeArgs, 3);

  // Remove undefined values
  Object.keys(types).forEach((key) => {
    if (types[key as keyof RequestTypeInfo] === undefined) {
      delete types[key as keyof RequestTypeInfo];
    }
  });

  return { types };
}

/**
 * Checks if a type node is an Express Request type.
 */
function isExpressRequestType(typeNode: TypeNode | undefined): typeNode is TypeReferenceNode {
  if (!typeNode || !Node.isTypeReference(typeNode)) {
    return false;
  }
  return typeNode.getTypeName().getText() === "Request";
}

/**
 * Extracts type info from a type argument at the given index, if present and non-empty.
 */
function extractTypeArgumentIfPresent(
  typeArgs: Node[],
  index: number,
): TypeInfo | undefined {
  if (typeArgs.length <= index) {
    return undefined;
  }

  const typeArg = typeArgs[index];
  if (isEmptyObject(typeArg)) {
    return undefined;
  }

  return extractTypeInfo(typeArg) ?? undefined;
}

// =============================================================================
// Response Parameter Extraction
// =============================================================================

/**
 * Extracts the response body type from the Response parameter (typically 'res').
 * Handles Response<ResBody, Locals>.
 */
function extractResponseTypeFromResponseParam(
  param: ParameterDeclaration,
): TypeInfo | null {
  const typeNode = param.getTypeNode();
  if (!isExpressResponseType(typeNode)) {
    return null;
  }

  const typeArgs = typeNode.getTypeArguments();
  if (typeArgs.length === 0) {
    return null;
  }

  const responseBodyArg = typeArgs[0];
  if (isEmptyObject(responseBodyArg)) {
    return null;
  }

  return extractTypeInfo(responseBodyArg);
}

/**
 * Checks if a type node is an Express Response type.
 */
function isExpressResponseType(typeNode: TypeNode | undefined): typeNode is TypeReferenceNode {
  if (!typeNode || !Node.isTypeReference(typeNode)) {
    return false;
  }
  return typeNode.getTypeName().getText() === "Response";
}

// =============================================================================
// Response Type Merging
// =============================================================================

/**
 * Merges response types from Request and Response parameters.
 *
 * Priority:
 * - If both are defined and match: use either (they're the same)
 * - If both are defined but different: use Response type and warn
 * - If only one is defined: use that one
 */
function mergeResponseTypes(
  fromRequest: TypeInfo | undefined,
  fromResponse: TypeInfo | null,
): TypeInfo | undefined {
  if (!fromResponse) {
    return fromRequest;
  }

  if (!fromRequest) {
    return fromResponse;
  }

  // Both are defined - check if they match
  const requestTypeText = getTypeText(fromRequest);
  const responseTypeText = getTypeText(fromResponse);

  if (requestTypeText !== responseTypeText) {
    console.warn(
      `Warning: Response type mismatch - Request specifies "${requestTypeText}" but Response specifies "${responseTypeText}". Using Response type.`
    );
    return fromResponse;
  }

  // Types match - use the one from Request (arbitrary choice, they're equivalent)
  return fromRequest;
}

/**
 * Gets a comparable text representation of a TypeInfo for comparison purposes.
 */
function getTypeText(typeInfo: TypeInfo): string {
  if (typeInfo.isNamed && typeInfo.typeName) {
    return typeInfo.typeName;
  }
  return typeInfo.resolvedTypeText || typeInfo.typeText || '';
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
 * to their actual structure by iterating over the type's properties. Nested object
 * types are recursively expanded to ensure all types are fully resolved.
 *
 * @param type - The resolved Type from ts-morph's typeChecker
 * @param typeNode - The AST node for context (used for getting property types)
 * @param visited - Set of visited type IDs to prevent infinite recursion on circular types
 * @returns A string representation of the type in TypeScript object literal syntax,
 *          e.g., "{ name: string; age?: number; address: { street: string; city: string } }"
 *
 * @example
 * // For Partial<User> where User = { name: string; age: number }
 * // Returns: "{ name?: string; age?: number }"
 *
 * @example
 * // For z.infer<typeof UserSchema>
 * // Returns the resolved structure: "{ name: string; email: string; role: \"admin\" | \"user\" }"
 *
 * @example
 * // For nested types like { user: User } where User = { name: string }
 * // Returns: "{ user: { name: string } }"
 */
export function expandTypeToStructure(type: Type, typeNode: Node, visited: Set<string> = new Set()): string {
  // Get a unique identifier for this type to detect circular references
  const typeId = getTypeIdentifier(type);
  if (visited.has(typeId)) {
    // Circular reference detected - return the type name to prevent infinite recursion
    return type.getText(typeNode);
  }

  // For types with properties, build the structural representation
  const properties = type.getProperties();

  if (properties.length === 0) {
    // Fallback to getText for types without properties (primitives, etc.)
    return type.getText(typeNode);
  }

  // Add this type to visited set before processing properties
  const newVisited = new Set(visited);
  newVisited.add(typeId);

  const memberTexts = properties.map((prop: TsSymbol) => {
    const propName = prop.getName();
    const propType = prop.getTypeAtLocation(typeNode);
    const isOptional = prop.isOptional();
    const optionalMarker = isOptional ? '?' : '';
    const propTypeText = expandPropertyType(propType, typeNode, newVisited);
    return `${propName}${optionalMarker}: ${propTypeText}`;
  });

  return `{ ${memberTexts.join('; ')} }`;
}

/**
 * Gets a unique identifier for a type to detect circular references.
 */
function getTypeIdentifier(type: Type): string {
  // Use the symbol's name if available, otherwise use the type text
  const symbol = type.getSymbol();
  if (symbol) {
    return symbol.getName() + '_' + (symbol.getDeclarations()?.[0]?.getStart() ?? '');
  }
  return type.getText();
}

/**
 * Expands a property type to its structural representation.
 *
 * Handles different type kinds:
 * - Primitives (string, number, boolean, etc.): Returns as-is
 * - Arrays: Recursively expands element type
 * - Objects with properties: Recursively expands to structural form
 * - Unions/Intersections: Returns the resolved text
 */
function expandPropertyType(type: Type, typeNode: Node, visited: Set<string>): string {
  // Check for array types first
  if (type.isArray()) {
    const elementType = type.getArrayElementType();
    if (elementType) {
      const expandedElement = expandPropertyType(elementType, typeNode, visited);
      return `${expandedElement}[]`;
    }
    return type.getText(typeNode);
  }

  // Check for union types
  if (type.isUnion()) {
    const unionTypes = type.getUnionTypes();
    const expandedUnion = unionTypes.map(t => expandPropertyType(t, typeNode, visited));
    return expandedUnion.join(' | ');
  }

  // Check for intersection types
  if (type.isIntersection()) {
    // For intersections, expand to merged structure
    return expandTypeToStructure(type, typeNode, visited);
  }

  // Check if this is an object type with properties (non-primitive)
  const properties = type.getProperties();
  if (properties.length > 0 && !isPrimitiveOrBuiltinType(type)) {
    // Recursively expand nested object types
    return expandTypeToStructure(type, typeNode, visited);
  }

  // For primitives and other types, use getText
  return type.getText(typeNode);
}

/**
 * Checks if a type is a primitive or built-in type that should not be expanded.
 */
function isPrimitiveOrBuiltinType(type: Type): boolean {
  // Check for primitive types
  if (type.isString() || type.isNumber() || type.isBoolean() ||
      type.isNull() || type.isUndefined() || type.isLiteral()) {
    return true;
  }

  // Check for common built-in types by name
  const typeName = type.getSymbol()?.getName();
  if (typeName) {
    const builtinTypes = new Set([
      'Date', 'RegExp', 'Error', 'Map', 'Set', 'WeakMap', 'WeakSet',
      'Promise', 'Array', 'Function', 'Symbol', 'BigInt',
      'ArrayBuffer', 'SharedArrayBuffer', 'DataView',
      'Int8Array', 'Uint8Array', 'Uint8ClampedArray',
      'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array',
      'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array',
    ]);
    if (builtinTypes.has(typeName)) {
      return true;
    }
  }

  return false;
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
