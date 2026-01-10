import { resolve } from 'path';
import { loadProject } from '../ast/project-loader.mjs';
import { discoverRoutes } from './route-discovery.mjs';
import { buildOpenApiSpec, BuildOptions } from './spec-builder.mjs';
import { OpenAPISpec } from '../types/openapi.mjs';

export interface GenerateOptions {
  entryPoint: string;
  title: string;
  version: string;
  description?: string;
  ignorePaths?: string[];
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
  const routes = discoverRoutes(sourceFile);

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

/**
 * Checks if a path should be ignored based on ignore patterns.
 * Supports exact matches and wildcard patterns (*, **).
 *
 * @param path - The route path to check
 * @param ignorePatterns - Array of patterns to ignore
 * @returns true if the path should be ignored
 */
function shouldIgnorePath(path: string, ignorePatterns: string[]): boolean {
  for (const pattern of ignorePatterns) {
    if (matchesPattern(path, pattern)) {
      return true;
    }
  }
  return false;
}

/**
 * Matches a path against a pattern with wildcard support.
 *
 * @param path - The path to match
 * @param pattern - The pattern (supports * and **)
 * @returns true if the path matches the pattern
 */
function matchesPattern(path: string, pattern: string): boolean {
  // Exact match
  if (path === pattern) {
    return true;
  }

  // Convert glob pattern to regex
  // Escape special regex characters except * and /
  let regexPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    // Replace ** with a placeholder
    .replace(/\*\*/g, '__DOUBLE_STAR__')
    // Replace * with [^/]* (match anything except /)
    .replace(/\*/g, '[^/]*')
    // Replace ** placeholder with .* (match anything including /)
    .replace(/__DOUBLE_STAR__/g, '.*');

  // Ensure the pattern matches the full path
  regexPattern = `^${regexPattern}$`;

  const regex = new RegExp(regexPattern);
  return regex.test(path);
}
