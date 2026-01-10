import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { createProgram } from '../../src/cli/commands.mjs';
import { writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

const FIXTURES_DIR = join(process.cwd(), 'test', 'fixtures', 'cli-test');
const OUTPUT_DIR = join(FIXTURES_DIR, 'output');

describe('CLI Commands', () => {
  beforeAll(() => {
    // Create test fixtures
    mkdirSync(FIXTURES_DIR, { recursive: true });
    mkdirSync(OUTPUT_DIR, { recursive: true });

    // Create a simple Express server file
    writeFileSync(
      join(FIXTURES_DIR, 'server.ts'),
      `
      import express, { Request, Response } from 'express';

      const app = express();

      /**
       * Get all users
       * @summary List users
       */
      function getUsers(req: Request, res: Response) {
        res.json([]);
      }

      app.get('/users', getUsers);
      `,
    );
  });

  afterAll(() => {
    // Clean up test fixtures
    rmSync(FIXTURES_DIR, { recursive: true, force: true });
  });

  beforeEach(() => {
    // Clear any previous console mocks
    vi.restoreAllMocks();
  });

  it('should have correct name and description', () => {
    // ARRANGE
    const program = createProgram();

    // ASSERT
    expect(program.name()).toBe('express-to-openapi');
    expect(program.description()).toBe(
      'Generate OpenAPI 3.0 specification from Express TypeScript code',
    );
  });

  it('should generate spec and write to file', async () => {
    // ARRANGE
    const program = createProgram();
    const outputFile = join(OUTPUT_DIR, 'output.json');
    const consoleSpy = vi.spyOn(console, 'log');

    // ACT
    await program.parseAsync([
      'node',
      'cli',
      join(FIXTURES_DIR, 'server.ts'),
      '--output',
      outputFile,
      '--title',
      'Test API',
      '--api-version',
      '2.0.0',
    ]);

    // ASSERT
    expect(existsSync(outputFile)).toBe(true);
    const content = readFileSync(outputFile, 'utf-8');
    const spec = JSON.parse(content);

    expect(spec.openapi).toBe('3.0.0');
    expect(spec.info.title).toBe('Test API');
    expect(spec.info.version).toBe('2.0.0');
    expect(spec.paths['/users']).toBeDefined();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('OpenAPI specification written to'),
    );
  });

  it('should output to stdout when no output file specified', async () => {
    // ARRANGE
    const program = createProgram();
    const consoleSpy = vi.spyOn(console, 'log');

    // ACT
    await program.parseAsync([
      'node',
      'cli',
      join(FIXTURES_DIR, 'server.ts'),
      '--title',
      'Test API',
    ]);

    // ASSERT
    expect(consoleSpy).toHaveBeenCalled();
    const output = consoleSpy.mock.calls[0][0];
    const spec = JSON.parse(output);

    expect(spec.openapi).toBe('3.0.0');
    expect(spec.info.title).toBe('Test API');
  });

  it('should handle description option', async () => {
    // ARRANGE
    const program = createProgram();
    const outputFile = join(OUTPUT_DIR, 'with-description.json');

    // ACT
    await program.parseAsync([
      'node',
      'cli',
      join(FIXTURES_DIR, 'server.ts'),
      '--output',
      outputFile,
      '--description',
      'This is a test API',
    ]);

    // ASSERT
    const content = readFileSync(outputFile, 'utf-8');
    const spec = JSON.parse(content);

    expect(spec.info.description).toBe('This is a test API');
  });

  it('should handle ignore patterns option', async () => {
    // ARRANGE
    const program = createProgram();
    const outputFile = join(OUTPUT_DIR, 'with-ignore.json');

    // Create a server with admin routes
    writeFileSync(
      join(FIXTURES_DIR, 'server-with-admin.ts'),
      `
      import express, { Request, Response } from 'express';

      const app = express();

      function getUsers(req: Request, res: Response) {
        res.json([]);
      }

      function getAdminStats(req: Request, res: Response) {
        res.json({});
      }

      app.get('/users', getUsers);
      app.get('/admin/stats', getAdminStats);
      `,
    );

    // ACT
    await program.parseAsync([
      'node',
      'cli',
      join(FIXTURES_DIR, 'server-with-admin.ts'),
      '--output',
      outputFile,
      '--ignore',
      '/admin/*',
    ]);

    // ASSERT
    const content = readFileSync(outputFile, 'utf-8');
    const spec = JSON.parse(content);

    expect(spec.paths['/users']).toBeDefined();
    expect(spec.paths['/admin/stats']).toBeUndefined();
  });

  it('should use default values when options not provided', async () => {
    // ARRANGE
    const program = createProgram();
    const outputFile = join(OUTPUT_DIR, 'defaults.json');

    // ACT
    await program.parseAsync([
      'node',
      'cli',
      join(FIXTURES_DIR, 'server.ts'),
      '--output',
      outputFile,
    ]);

    // ASSERT
    const content = readFileSync(outputFile, 'utf-8');
    const spec = JSON.parse(content);

    expect(spec.info.title).toBe('API'); // Default title
    expect(spec.info.version).toBe('1.0.0'); // Default version
  });

  it('should exit with error for non-existent entry point', async () => {
    // ARRANGE
    const program = createProgram();
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const errorSpy = vi.spyOn(console, 'error');

    // ACT & ASSERT
    await expect(
      program.parseAsync([
        'node',
        'cli',
        join(FIXTURES_DIR, 'non-existent.ts'),
      ]),
    ).rejects.toThrow('process.exit called');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(
      'Error generating OpenAPI specification:',
    );
  });
});
