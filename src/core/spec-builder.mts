import { RouteInfo } from '../types/internal.mjs';
import {
  OpenAPISpec,
  PathsObject,
  PathItemObject,
  OperationObject,
} from '../types/openapi.mjs';
import { parseJsDoc } from './jsdoc-parser.mjs';

export interface BuildOptions {
  title: string;
  version: string;
  description?: string;
}

export function buildOpenApiSpec(
  routes: RouteInfo[],
  options: BuildOptions,
): OpenAPISpec {
  const paths = buildPaths(routes);

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

function buildPaths(routes: RouteInfo[]): PathsObject {
  const paths: PathsObject = {};

  for (const route of routes) {
    const { path, method, handlerName, handlerNode } = route;

    // Initialize path item if it doesn't exist
    if (!paths[path]) {
      paths[path] = {};
    }

    const pathItem: PathItemObject = paths[path];

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

    // Add operation to path item based on method
    pathItem[method] = operation;
  }

  return paths;
}
