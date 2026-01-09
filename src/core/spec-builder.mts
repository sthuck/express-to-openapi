import { RouteInfo } from '../types/internal.mjs';
import {
  OpenAPISpec,
  PathsObject,
  PathItemObject,
  OperationObject,
  ParameterObject,
  SchemaObject,
} from '../types/openapi.mjs';
import { parseJsDoc } from './jsdoc-parser.mjs';
import { extractRequestTypes } from './type-extraction.mjs';
import { convertTypeToSchema } from './type-converter.mjs';

export interface BuildOptions {
  title: string;
  version: string;
  description?: string;
}

export async function buildOpenApiSpec(
  routes: RouteInfo[],
  options: BuildOptions,
): Promise<OpenAPISpec> {
  const paths = await buildPaths(routes);

  return {
    openapi: '3.0.0',
    info: {
      title: options.title,
      version: options.version,
      description: options.description,
    },
    paths,
    components: {
      schemas: {},
    },
  };
}

async function buildPaths(routes: RouteInfo[]): Promise<PathsObject> {
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

    // Create operation
    const operation: OperationObject = {
      responses: {
        '200': {
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

    // Extract and add path parameters
    const pathParams = await extractPathParameters(path, handlerNode);
    if (pathParams.length > 0) {
      operation.parameters = pathParams;
    }

    // Add operation to path item based on method
    pathItem[method] = operation;
  }

  return paths;
}

function convertExpressPathToOpenAPI(path: string): string {
  return path.replace(/:(\w+)/g, '{$1}');
}

function extractPathParamNames(path: string): string[] {
  const matches = Array.from(path.matchAll(/:(\w+)/g));
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
