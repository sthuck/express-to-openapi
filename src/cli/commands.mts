import { Command } from 'commander';
import { generateOpenApiSpec, GenerateOptions } from '../core/orchestrator.mjs';
import { writeFileSync } from 'fs';
import { initLogger } from '../utils/logger.mjs';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('express-to-openapi')
    .description('Generate OpenAPI 3.0 specification from Express TypeScript code')
    .version('1.0.0');

  program
    .argument('<entry-point>', 'Path to the Express server entry point file')
    .option('-o, --output <file>', 'Output file path (defaults to stdout)')
    .option('-t, --title <title>', 'API title', 'API')
    .option('-v, --api-version <version>', 'API version', '1.0.0')
    .option('-d, --description <description>', 'API description')
    .option(
      '-i, --ignore <patterns...>',
      'Path patterns to ignore (supports wildcards)',
    )
    .option('--debug', 'Enable debug logging')
    .action(async (entryPoint: string, options) => {
      try {
        // Initialize logger based on debug flag
        initLogger(options.debug);

        const generateOptions: GenerateOptions = {
          entryPoint,
          title: options.title,
          version: options.apiVersion,
          description: options.description,
          ignorePaths: options.ignore,
        };

        const spec = await generateOpenApiSpec(generateOptions);

        const output = JSON.stringify(spec, null, 2);

        if (options.output) {
          writeFileSync(options.output, output, 'utf-8');
          console.log(`OpenAPI specification written to ${options.output}`);
        } else {
          console.log(output);
        }
      } catch (error) {
        console.error('Error generating OpenAPI specification:');
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return program;
}
