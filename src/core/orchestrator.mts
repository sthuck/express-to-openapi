import { resolve } from 'path';
import { loadProject } from '../ast/project-loader.mjs';
import { discoverRoutes, DiscoverRoutesOptions } from './route-discovery.mjs';
import { buildOpenApiSpec, BuildOptions } from './spec-builder.mjs';
import { OpenAPISpec } from '../types/openapi.mjs';
import { shouldIgnorePath } from '../utils/path-matcher.mjs';

export interface GenerateOptions {
  entryPoint: string;
  title: string;
  version: string;
  description?: string;
  ignorePaths?: string[];
  /** Regex patterns to match wrapper function names (e.g., asyncHandler, authMiddleware) */
  wrapperPatterns?: string[];
}

/**
 * Main orchestrator function that generates an OpenAPI specification
 * from an Express TypeScript entry point file.
 *
 * @param options - Configuration options for spec generation
 * @returns The generated OpenAPI 3.0 specification
 */
export async function generateOpenApiSpec(
  options: GenerateOptions,
): Promise<OpenAPISpec> {
  // Load the TypeScript project
  const project = loadProject(options.entryPoint);

  // Get the entry point source file
  const absolutePath = resolve(options.entryPoint);
  const sourceFile = project.getSourceFile(absolutePath);

  if (!sourceFile) {
    throw new Error(`Could not load source file: ${absolutePath}`);
  }

  // Discover all routes in the Express application
  const discoverOptions: DiscoverRoutesOptions = {};
  if (options.wrapperPatterns && options.wrapperPatterns.length > 0) {
    discoverOptions.wrapperPatterns = options.wrapperPatterns.map(
      (pattern) => new RegExp(pattern),
    );
  }
  const routes = discoverRoutes(sourceFile, discoverOptions);

  // Filter out ignored paths if specified
  const filteredRoutes = options.ignorePaths
    ? routes.filter((route) => !shouldIgnorePath(route.path, options.ignorePaths!))
    : routes;

  // Build the OpenAPI specification
  const buildOptions: BuildOptions = {
    title: options.title,
    version: options.version,
    description: options.description,
  };

  const spec = await buildOpenApiSpec(filteredRoutes, buildOptions);

  return spec;
}
