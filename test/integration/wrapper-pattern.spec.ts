import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { generateOpenApiSpec } from '../../src/core/orchestrator.mjs';

describe('Wrapper Pattern Integration', () => {
  const fixturesPath = join(__dirname, '../fixtures/wrapper-pattern-server');

  it('should extract types from handlers wrapped with asyncHandler', async () => {
    // ARRANGE
    const entryPoint = join(fixturesPath, 'main.ts');

    // ACT
    const spec = await generateOpenApiSpec({
      entryPoint,
      title: 'Wrapper Test API',
      version: '1.0.0',
    });

    // ASSERT - routes wrapped with asyncHandler should have types extracted
    expect(spec.paths['/users/{id}']).toBeDefined();
    const getUserOp = spec.paths['/users/{id}']?.get;
    expect(getUserOp).toBeDefined();
    expect(getUserOp?.summary).toBe('Get a user');

    // Path parameters should be extracted from UserParams type
    expect(getUserOp?.parameters).toBeDefined();
    expect(getUserOp?.parameters?.length).toBeGreaterThan(0);
    const idParam = getUserOp?.parameters?.find(p => p.name === 'id');
    expect(idParam).toBeDefined();

    // Response type should be extracted (UserResponse)
    expect(getUserOp?.responses?.['200']).toBeDefined();
    const response200 = getUserOp?.responses?.['200'] as { content?: Record<string, unknown> };
    expect(response200.content).toBeDefined();
    expect(response200.content?.['application/json']).toBeDefined();
  });

  it('should extract types from POST handlers wrapped with asyncHandler', async () => {
    // ARRANGE
    const entryPoint = join(fixturesPath, 'main.ts');

    // ACT
    const spec = await generateOpenApiSpec({
      entryPoint,
      title: 'Wrapper Test API',
      version: '1.0.0',
    });

    // ASSERT - POST /users should have request body from UserBody
    expect(spec.paths['/users']).toBeDefined();
    const postUserOp = spec.paths['/users']?.post;
    expect(postUserOp).toBeDefined();
    expect(postUserOp?.summary).toBe('Create user');
    expect(postUserOp?.requestBody).toBeDefined();
  });

  it('should extract types from handlers wrapped with withAuth', async () => {
    // ARRANGE
    const entryPoint = join(fixturesPath, 'main.ts');

    // ACT
    const spec = await generateOpenApiSpec({
      entryPoint,
      title: 'Wrapper Test API',
      version: '1.0.0',
    });

    // ASSERT - /admin wrapped with withAuth should have types extracted
    expect(spec.paths['/admin']).toBeDefined();
    const adminOp = spec.paths['/admin']?.get;
    expect(adminOp).toBeDefined();
    expect(adminOp?.summary).toBe('Admin endpoint');
  });

  it('should handle custom wrapper patterns via CLI option', async () => {
    // ARRANGE
    const entryPoint = join(fixturesPath, 'main.ts');

    // ACT - use custom wrapper pattern to match myCustomAsyncWrapper
    const spec = await generateOpenApiSpec({
      entryPoint,
      title: 'Wrapper Test API',
      version: '1.0.0',
      wrapperPatterns: ['myCustom.*'],  // Regex pattern as string
    });

    // ASSERT - /custom wrapped with myCustomAsyncWrapper should have types extracted
    expect(spec.paths['/custom']).toBeDefined();
    const customOp = spec.paths['/custom']?.get;
    expect(customOp).toBeDefined();
    expect(customOp?.summary).toBe('Custom wrapped endpoint');
  });

  it('should handle nested wrappers (withAuth + asyncHandler)', async () => {
    // ARRANGE
    const entryPoint = join(fixturesPath, 'main.ts');

    // ACT
    const spec = await generateOpenApiSpec({
      entryPoint,
      title: 'Wrapper Test API',
      version: '1.0.0',
    });

    // ASSERT - /nested with nested wrappers should have types extracted
    expect(spec.paths['/nested']).toBeDefined();
    const nestedOp = spec.paths['/nested']?.get;
    expect(nestedOp).toBeDefined();
    expect(nestedOp?.summary).toBe('Nested wrappers');
  });

  it('should handle routes without wrappers correctly', async () => {
    // ARRANGE
    const entryPoint = join(fixturesPath, 'main.ts');

    // ACT
    const spec = await generateOpenApiSpec({
      entryPoint,
      title: 'Wrapper Test API',
      version: '1.0.0',
    });

    // ASSERT - /direct without wrapper should work as before
    expect(spec.paths['/direct']).toBeDefined();
    const directOp = spec.paths['/direct']?.get;
    expect(directOp).toBeDefined();
    expect(directOp?.summary).toBe('Direct handler');
  });

  it('should extract response types from wrapped handlers', async () => {
    // ARRANGE
    const entryPoint = join(fixturesPath, 'main.ts');

    // ACT
    const spec = await generateOpenApiSpec({
      entryPoint,
      title: 'Wrapper Test API',
      version: '1.0.0',
    });

    // ASSERT - GET /users/:id should have UserResponse type extracted
    const getUserOp = spec.paths['/users/{id}']?.get;
    expect(getUserOp?.responses?.['200']).toBeDefined();

    const response200 = getUserOp?.responses?.['200'] as {
      content?: {
        'application/json'?: {
          schema?: { $ref?: string } | { type?: string; properties?: Record<string, unknown> };
        };
      };
    };

    // Should have application/json content with schema
    expect(response200.content?.['application/json']?.schema).toBeDefined();
    const schema = response200.content?.['application/json']?.schema;

    // Should reference UserResponse in components or have inline properties
    if ('$ref' in (schema || {})) {
      expect((schema as { $ref: string }).$ref).toContain('UserResponse');
      // Verify the schema exists in components
      expect(spec.components?.schemas?.['UserResponse']).toBeDefined();
    } else {
      // Inline schema should have the expected properties
      const inlineSchema = schema as { properties?: Record<string, unknown> };
      expect(inlineSchema.properties).toBeDefined();
    }
  });

  it('should extract response types from nested wrapped handlers', async () => {
    // ARRANGE
    const entryPoint = join(fixturesPath, 'main.ts');

    // ACT
    const spec = await generateOpenApiSpec({
      entryPoint,
      title: 'Wrapper Test API',
      version: '1.0.0',
    });

    // ASSERT - GET /nested should have response type extracted despite nested wrappers
    const nestedOp = spec.paths['/nested']?.get;
    expect(nestedOp?.responses?.['200']).toBeDefined();

    const response200 = nestedOp?.responses?.['200'] as {
      content?: {
        'application/json'?: {
          schema?: { properties?: Record<string, unknown> };
        };
      };
    };

    // Should have application/json content with schema containing 'nested' property
    expect(response200.content?.['application/json']?.schema).toBeDefined();
    const schema = response200.content?.['application/json']?.schema;
    expect(schema?.properties?.['nested']).toBeDefined();
  });

  it('should discover all routes in fixture', async () => {
    // ARRANGE
    const entryPoint = join(fixturesPath, 'main.ts');

    // ACT - use patterns that match all wrappers in the fixture
    // Note: Custom patterns replace the default names, so we need to include
    // patterns for all wrappers used in the fixture
    const spec = await generateOpenApiSpec({
      entryPoint,
      title: 'Wrapper Test API',
      version: '1.0.0',
      wrapperPatterns: [
        'asyncHandler',      // exact match for asyncHandler
        'myCustom.*',        // matches myCustomAsyncWrapper
        'withAuth',          // exact match for withAuth
        'validate.*',        // matches validateRequest
      ],
    });

    // ASSERT - all routes should be discovered
    const paths = Object.keys(spec.paths);
    expect(paths).toContain('/users/{id}');
    expect(paths).toContain('/users');
    expect(paths).toContain('/admin');
    expect(paths).toContain('/custom');
    expect(paths).toContain('/nested');
    expect(paths).toContain('/validated');
    expect(paths).toContain('/direct');
  });
});
