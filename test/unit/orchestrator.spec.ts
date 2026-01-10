import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { generateOpenApiSpec } from '../../src/core/orchestrator.mjs';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

const FIXTURES_DIR = join(process.cwd(), 'test', 'fixtures', 'orchestrator-test');

describe('Orchestrator', () => {
  beforeAll(() => {
    // Create test fixtures
    mkdirSync(FIXTURES_DIR, { recursive: true });

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

      /**
       * Create a new user
       * @summary Create user
       */
      function createUser(
        req: Request<{}, {}, { name: string; email: string }>,
        res: Response
      ) {
        res.json({ id: 1 });
      }

      /**
       * Admin endpoint
       */
      function getAdminStats(req: Request, res: Response) {
        res.json({});
      }

      app.get('/users', getUsers);
      app.post('/users', createUser);
      app.get('/admin/stats', getAdminStats);
      `,
    );
  });

  afterAll(() => {
    // Clean up test fixtures
    rmSync(FIXTURES_DIR, { recursive: true, force: true });
  });

  it('should generate OpenAPI spec from entry point', async () => {
    // ARRANGE
    const options = {
      entryPoint: join(FIXTURES_DIR, 'server.ts'),
      title: 'Test API',
      version: '1.0.0',
      description: 'A test API',
    };

    // ACT
    const spec = await generateOpenApiSpec(options);

    // ASSERT
    expect(spec.openapi).toBe('3.0.0');
    expect(spec.info).toMatchObject({
      title: 'Test API',
      version: '1.0.0',
      description: 'A test API',
    });

    // Should have discovered all routes
    expect(spec.paths['/users']).toBeDefined();
    expect(spec.paths['/users'].get).toBeDefined();
    expect(spec.paths['/users'].post).toBeDefined();
    expect(spec.paths['/admin/stats']).toBeDefined();

    // Should have correct operation details
    expect(spec.paths['/users'].get?.summary).toBe('List users');
    expect(spec.paths['/users'].get?.operationId).toBe('getUsers');
    expect(spec.paths['/users'].post?.summary).toBe('Create user');
    expect(spec.paths['/users'].post?.operationId).toBe('createUser');
  });

  it('should filter ignored paths with exact match', async () => {
    // ARRANGE
    const options = {
      entryPoint: join(FIXTURES_DIR, 'server.ts'),
      title: 'Test API',
      version: '1.0.0',
      ignorePaths: ['/admin/stats'],
    };

    // ACT
    const spec = await generateOpenApiSpec(options);

    // ASSERT
    expect(spec.paths['/users']).toBeDefined();
    expect(spec.paths['/admin/stats']).toBeUndefined();
  });

  it('should filter ignored paths with wildcard pattern', async () => {
    // ARRANGE
    const options = {
      entryPoint: join(FIXTURES_DIR, 'server.ts'),
      title: 'Test API',
      version: '1.0.0',
      ignorePaths: ['/admin/*'],
    };

    // ACT
    const spec = await generateOpenApiSpec(options);

    // ASSERT
    expect(spec.paths['/users']).toBeDefined();
    expect(spec.paths['/admin/stats']).toBeUndefined();
  });

  it('should filter ignored paths with double wildcard pattern', async () => {
    // ARRANGE
    const options = {
      entryPoint: join(FIXTURES_DIR, 'server.ts'),
      title: 'Test API',
      version: '1.0.0',
      ignorePaths: ['/admin/**'],
    };

    // ACT
    const spec = await generateOpenApiSpec(options);

    // ASSERT
    expect(spec.paths['/users']).toBeDefined();
    expect(spec.paths['/admin/stats']).toBeUndefined();
  });

  it('should throw error for non-existent entry point', async () => {
    // ARRANGE
    const options = {
      entryPoint: join(FIXTURES_DIR, 'non-existent.ts'),
      title: 'Test API',
      version: '1.0.0',
    };

    // ACT & ASSERT
    await expect(generateOpenApiSpec(options)).rejects.toThrow(
      'Entry point file not found',
    );
  });

  it('should generate spec without description', async () => {
    // ARRANGE
    const options = {
      entryPoint: join(FIXTURES_DIR, 'server.ts'),
      title: 'Test API',
      version: '1.0.0',
    };

    // ACT
    const spec = await generateOpenApiSpec(options);

    // ASSERT
    expect(spec.info.title).toBe('Test API');
    expect(spec.info.version).toBe('1.0.0');
    expect(spec.info.description).toBeUndefined();
  });

  it('should handle multiple ignore patterns', async () => {
    // ARRANGE
    const options = {
      entryPoint: join(FIXTURES_DIR, 'server.ts'),
      title: 'Test API',
      version: '1.0.0',
      ignorePaths: ['/admin/*', '/internal/*'],
    };

    // ACT
    const spec = await generateOpenApiSpec(options);

    // ASSERT
    expect(spec.paths['/users']).toBeDefined();
    expect(spec.paths['/admin/stats']).toBeUndefined();
  });
});
