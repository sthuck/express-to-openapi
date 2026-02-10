import { Node } from 'ts-morph';
import { RouteInfo } from '../types/internal.mjs';
import {
  OpenAPISpec,
  PathsObject,
  PathItemObject,
  OperationObject,
  ParameterObject,
  SchemaObject,
  ReferenceObject,
} from '../types/openapi.mjs';
import { parseJsDoc } from './jsdoc-parser.mjs';
import {
  extractRequestTypes,
  expandTypeToStructure,
} from './type-extraction.mjs';
import { convertTypeToSchema } from './type-converter.mjs';

export interface BuildOptions {
  title: string;
  version: string;
  description?: string;
}

// Context to track schemas during spec building
interface BuildContext {
  schemas: { [key: string]: SchemaObject };
}

export async function buildOpenApiSpec(
  routes: RouteInfo[],
  options: BuildOptions,
): Promise<OpenAPISpec> {
  const context: BuildContext = {
    schemas: {},
  };

  const paths = await buildPaths(routes, context);

  return {
    openapi: '3.0.0',
    info: {
      title: options.title,
      version: options.version,
      description: options.description,
    },
    paths,
    components: {
      schemas: context.schemas,
    },
  };
}

async function buildPaths(
  routes: RouteInfo[],
  context: BuildContext,
): Promise<PathsObject> {
  const paths: PathsObject = {};

  for (const route of routes) {
    const { path, method, handlerName, handlerNode } = route;

    // Convert Express path format to OpenAPI format
    const openApiPath = convertExpressPathToOpenAPI(path);

    // Initialize path item if it doesn't exist
    if (!paths[openApiPath]) {
      paths[openApiPath] = {};
    }

    const pathItem: PathItemObject = paths[openApiPath];

    // Extract response body schema
    const responseBody = await extractResponseBody(handlerNode, context);

    // Create operation
    const operation: OperationObject = {
      responses: {
        '200': responseBody || {
          description: 'Successful response',
        },
      },
    };

    // Add operationId if handler name exists
    if (handlerName) {
      operation.operationId = handlerName;
    }

    // Extract and add JSDoc information
    const jsDoc = parseJsDoc(handlerNode);
    if (jsDoc) {
      if (jsDoc.summary) {
        operation.summary = jsDoc.summary;
      }
      if (jsDoc.description) {
        operation.description = jsDoc.description;
      }
    }

    // Check if handler has type information
    const requestTypes = extractRequestTypes(handlerNode);
    const hasTypeInfo = requestTypes !== null;

    // Warn if no type information found
    if (!hasTypeInfo) {
      const methodUpper = method.toUpperCase();
      console.warn(
        `Warning: Route ${methodUpper} ${path} has no type information. ` +
          `Consider adding Request type annotations for better OpenAPI spec generation.`,
      );
    }

    // Extract and add path parameters
    const pathParams = await extractPathParameters(path, handlerNode);

    // Extract and add query parameters
    const queryParams = await extractQueryParameters(handlerNode);

    // Combine parameters
    const allParams = [...pathParams, ...queryParams];
    if (allParams.length > 0) {
      operation.parameters = allParams;
    }

    // Extract and add request body for POST/PUT/PATCH
    if (['post', 'put', 'patch'].includes(method)) {
      const requestBody = await extractRequestBody(handlerNode, context);
      if (requestBody) {
        operation.requestBody = requestBody;
      }
    }

    // Add operation to path item based on method
    pathItem[method] = operation;
  }

  return paths;
}

/**
 * Convert Express path format to OpenAPI format
 * Handles custom parameter patterns like:
 * - :param -> {param}
 * - :param(*) -> {param}
 * - :param(\d+) -> {param}
 * - :param([a-z-]+)? -> {param}
 */
function convertExpressPathToOpenAPI(path: string): string {
  // Match :paramName followed by optional (pattern) and optional ?
  // Examples: :id, :id(*), :id(\d+), :id([a-z-]+)?
  return path.replace(/:(\w+)(?:\([^)]*\))?\??/g, '{$1}');
}

/**
 * Extract parameter names from Express path
 * Handles custom parameter patterns
 */
function extractPathParamNames(path: string): string[] {
  // Match :paramName followed by optional (pattern) and optional ?
  const matches = Array.from(path.matchAll(/:(\w+)(?:\([^)]*\))?\??/g));
  return matches.map((m) => m[1]);
}

async function extractPathParameters(
  path: string,
  handlerNode: any,
): Promise<ParameterObject[]> {
  const paramNames = extractPathParamNames(path);
  if (paramNames.length === 0) {
    return [];
  }

  // Extract type information from handler
  const typeInfo = extractRequestTypes(handlerNode);
  let pathParamSchema: SchemaObject | undefined;

  if (typeInfo?.pathParams) {
    if (typeInfo.pathParams.isNamed || typeInfo.pathParams.typeText) {
      // Convert the type to OpenAPI schema
      const typeText =
        typeInfo.pathParams.typeText ||
        typeInfo.pathParams.typeNode?.getText() ||
        '';
      pathParamSchema = await convertTypeToSchema(typeText);
    }
  }

  // Create parameter objects for each path parameter
  const parameters: ParameterObject[] = [];
  for (const paramName of paramNames) {
    const param: ParameterObject = {
      name: paramName,
      in: 'path',
      required: true,
      schema: { type: 'string' }, // Default to string
    };

    // If we have schema info, extract the specific property type
    if (pathParamSchema?.properties?.[paramName]) {
      param.schema = pathParamSchema.properties[paramName] as SchemaObject;
    }

    parameters.push(param);
  }

  return parameters;
}

async function extractQueryParameters(
  handlerNode: any,
): Promise<ParameterObject[]> {
  // Extract type information from handler
  const typeInfo = extractRequestTypes(handlerNode);

  if (!typeInfo?.queryParams) {
    return [];
  }

  let typeText = '';

  let queryParamSchema: SchemaObject;

  if (typeInfo.queryParams.isNamed && typeInfo.queryParams.typeNode) {
    // For named types, use typeChecker to resolve to structural form
    const type = typeInfo.queryParams.typeNode.getType();
    typeText = expandTypeToStructure(type, typeInfo.queryParams.typeNode);

    if (!typeText) {
      return [];
    }
    queryParamSchema = await convertTypeToSchema(typeText);
  } else {
    // For inline types and resolved utility types, use the text directly
    typeText =
      typeInfo.queryParams.resolvedTypeText ||
      typeInfo.queryParams.typeText ||
      '';
    if (!typeText) {
      return [];
    }
    queryParamSchema = await convertTypeToSchema(typeText);
  }

  // Create parameter objects for each query parameter property
  const parameters: ParameterObject[] = [];

  if (queryParamSchema?.properties) {
    for (const [paramName, paramSchema] of Object.entries(
      queryParamSchema.properties,
    )) {
      const param: ParameterObject = {
        name: paramName,
        in: 'query',
        required: false, // Query params are optional by default
        schema: paramSchema as SchemaObject,
      };

      parameters.push(param);
    }
  }

  return parameters;
}

async function extractRequestBody(
  handlerNode: any,
  context: BuildContext,
): Promise<{
  required: boolean;
  content: { [key: string]: { schema: SchemaObject | ReferenceObject } };
} | null> {
  // Extract type information from handler
  const typeInfo = extractRequestTypes(handlerNode);

  if (!typeInfo?.bodyParams) {
    return null;
  }

  let schema: SchemaObject | ReferenceObject;

  if (typeInfo.bodyParams.isNamed && typeInfo.bodyParams.typeName) {
    // For named types, add to components.schemas and use $ref
    const typeName = typeInfo.bodyParams.typeName;

    // Only add to schemas if it doesn't already exist
    if (!context.schemas[typeName]) {
      const typeNode = typeInfo.bodyParams.typeNode;
      if (!typeNode) {
        return null;
      }

      // Use typeChecker to resolve to structural form (supports z.infer, etc.)
      const type = typeNode.getType();
      const typeText = expandTypeToStructure(type, typeNode);

      if (!typeText) {
        return null;
      }

      // Convert to OpenAPI schema and add to components
      const bodySchema = await convertTypeToSchema(typeText);
      context.schemas[typeName] = bodySchema;
    }

    // Use $ref to reference the schema
    schema = { $ref: `#/components/schemas/${typeName}` };
  } else {
    // For inline types and resolved utility types, inline the schema
    const typeText =
      typeInfo.bodyParams.resolvedTypeText ||
      typeInfo.bodyParams.typeText ||
      '';
    if (!typeText) {
      return null;
    }

    schema = await convertTypeToSchema(typeText);
  }

  return {
    required: true,
    content: {
      'application/json': {
        schema,
      },
    },
  };
}

async function extractResponseBody(
  handlerNode: any,
  context: BuildContext,
): Promise<{
  description: string;
  content?: { [key: string]: { schema: SchemaObject | ReferenceObject } };
} | null> {
  // Extract type information from handler
  const typeInfo = extractRequestTypes(handlerNode);

  if (!typeInfo?.responseBody) {
    // Return default response without schema
    return {
      description: 'Successful response',
    };
  }

  let schema: SchemaObject | ReferenceObject;

  if (typeInfo.responseBody.isNamed && typeInfo.responseBody.typeName) {
    // For named types, add to components.schemas and use $ref
    const typeName = typeInfo.responseBody.typeName;

    // Only add to schemas if it doesn't already exist
    if (!context.schemas[typeName]) {
      const typeNode = typeInfo.responseBody.typeNode;
      if (!typeNode) {
        return {
          description: 'Successful response',
        };
      }

      // Use typeChecker to resolve to structural form (supports z.infer, etc.)
      const type = typeNode.getType();
      const typeText = expandTypeToStructure(type, typeNode);

      if (!typeText) {
        return {
          description: 'Successful response',
        };
      }

      // Convert to OpenAPI schema and add to components
      const responseSchema = await convertTypeToSchema(typeText);
      context.schemas[typeName] = responseSchema;
    }

    // Use $ref to reference the schema
    schema = { $ref: `#/components/schemas/${typeName}` };
  } else {
    // For inline types and resolved utility types, inline the schema
    const typeText =
      typeInfo.responseBody.resolvedTypeText ||
      typeInfo.responseBody.typeText ||
      '';
    if (!typeText) {
      return {
        description: 'Successful response',
      };
    }

    schema = await convertTypeToSchema(typeText);
  }

  return {
    description: 'Successful response',
    content: {
      'application/json': {
        schema,
      },
    },
  };
}
