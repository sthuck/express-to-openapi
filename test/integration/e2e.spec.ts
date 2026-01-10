import { describe, it, expect } from 'vitest';
import { generateOpenApiSpec } from '../../src/core/orchestrator.mjs';
import { join } from 'path';

const COMPLEX_SERVER_PATH = join(
  process.cwd(),
  'test',
  'fixtures',
  'complex-server',
  'main.ts',
);

describe('End-to-End Integration', () => {
  it('should generate complete OpenAPI spec from complex Express server', async () => {
    // ARRANGE
    const options = {
      entryPoint: COMPLEX_SERVER_PATH,
      title: 'Complex API',
      version: '1.0.0',
      description: 'A complex API with nested routers and various types',
    };

    // ACT
    const spec = await generateOpenApiSpec(options);

    // ASSERT - Basic structure
    expect(spec.openapi).toBe('3.0.0');
    expect(spec.info).toMatchObject({
      title: 'Complex API',
      version: '1.0.0',
      description: 'A complex API with nested routers and various types',
    });

    // ASSERT - Root endpoints
    expect(spec.paths['/health']).toBeDefined();
    expect(spec.paths['/health'].get).toBeDefined();
    expect(spec.paths['/health'].get?.operationId).toBe('healthCheck');
    expect(spec.paths['/health'].get?.summary).toBe('Check API health');

    expect(spec.paths['/info']).toBeDefined();
    expect(spec.paths['/info'].get).toBeDefined();
    expect(spec.paths['/info'].get?.operationId).toBe('getApiInfo');

    // ASSERT - User routes
    expect(spec.paths['/api/users']).toBeDefined();
    expect(spec.paths['/api/users'].get).toBeDefined();
    expect(spec.paths['/api/users'].get?.operationId).toBe('listUsers');
    expect(spec.paths['/api/users'].get?.summary).toBe('Get all users');

    // Check pagination query params
    const listUsersParams = spec.paths['/api/users'].get?.parameters;
    expect(listUsersParams).toBeDefined();
    expect(listUsersParams?.length).toBeGreaterThanOrEqual(2);
    const pageParam = listUsersParams?.find((p) => p.name === 'page');
    const limitParam = listUsersParams?.find((p) => p.name === 'limit');
    expect(pageParam).toMatchObject({
      name: 'page',
      in: 'query',
      required: false,
      schema: { type: 'number' },
    });
    expect(limitParam).toMatchObject({
      name: 'limit',
      in: 'query',
      required: false,
      schema: { type: 'number' },
    });

    // Check POST /api/users with named body type
    expect(spec.paths['/api/users'].post).toBeDefined();
    expect(spec.paths['/api/users'].post?.operationId).toBe('createUser');
    expect(spec.paths['/api/users'].post?.requestBody).toBeDefined();
    expect(
      spec.paths['/api/users'].post?.requestBody?.content['application/json']
        .schema,
    ).toEqual({
      $ref: '#/components/schemas/CreateUserRequest',
    });

    // Check PUT /api/users/:id with path param and named body type
    expect(spec.paths['/api/users/{id}']).toBeDefined();
    expect(spec.paths['/api/users/{id}'].put).toBeDefined();
    expect(spec.paths['/api/users/{id}'].put?.operationId).toBe('updateUser');

    const updateUserParams = spec.paths['/api/users/{id}'].put?.parameters;
    expect(updateUserParams).toBeDefined();
    const idParam = updateUserParams?.find((p) => p.name === 'id');
    expect(idParam).toMatchObject({
      name: 'id',
      in: 'path',
      required: true,
      schema: { type: 'string' },
    });

    expect(
      spec.paths['/api/users/{id}'].put?.requestBody?.content[
        'application/json'
      ].schema,
    ).toEqual({
      $ref: '#/components/schemas/UpdateUserRequest',
    });

    // Check GET /api/users/:id
    expect(spec.paths['/api/users/{id}'].get).toBeDefined();
    expect(spec.paths['/api/users/{id}'].get?.operationId).toBe('getUserById');

    // Check DELETE /api/users/:id
    expect(spec.paths['/api/users/{id}'].delete).toBeDefined();
    expect(spec.paths['/api/users/{id}'].delete?.operationId).toBe(
      'deleteUser',
    );

    // Check search endpoint with inline query params
    expect(spec.paths['/api/users/search']).toBeDefined();
    expect(spec.paths['/api/users/search'].get).toBeDefined();
    expect(spec.paths['/api/users/search'].get?.operationId).toBe(
      'searchUsers',
    );
    const searchParams = spec.paths['/api/users/search'].get?.parameters;
    expect(searchParams).toBeDefined();
    const qParam = searchParams?.find((p) => p.name === 'q');
    expect(qParam).toMatchObject({
      name: 'q',
      in: 'query',
      required: false,
      schema: { type: 'string' },
    });

    // ASSERT - Nested post routes under users
    expect(spec.paths['/api/users/{userId}/posts']).toBeDefined();
    expect(spec.paths['/api/users/{userId}/posts'].get).toBeDefined();
    expect(spec.paths['/api/users/{userId}/posts'].get?.operationId).toBe(
      'getUserPosts',
    );

    const getUserPostsParams =
      spec.paths['/api/users/{userId}/posts'].get?.parameters;
    const userIdParam = getUserPostsParams?.find((p) => p.name === 'userId');
    expect(userIdParam).toMatchObject({
      name: 'userId',
      in: 'path',
      required: true,
      schema: { type: 'string' },
    });

    // Check POST /api/users/:userId/posts with named body type
    expect(spec.paths['/api/users/{userId}/posts'].post).toBeDefined();
    expect(spec.paths['/api/users/{userId}/posts'].post?.operationId).toBe(
      'createUserPost',
    );
    expect(
      spec.paths['/api/users/{userId}/posts'].post?.requestBody?.content[
        'application/json'
      ].schema,
    ).toEqual({
      $ref: '#/components/schemas/CreatePostRequest',
    });

    // Check nested post detail routes
    expect(spec.paths['/api/users/{userId}/posts/{postId}']).toBeDefined();
    expect(spec.paths['/api/users/{userId}/posts/{postId}'].get).toBeDefined();
    expect(
      spec.paths['/api/users/{userId}/posts/{postId}'].get?.operationId,
    ).toBe('getUserPost');

    const getPostParams =
      spec.paths['/api/users/{userId}/posts/{postId}'].get?.parameters;
    expect(getPostParams?.length).toBe(2);
    const postIdParam = getPostParams?.find((p) => p.name === 'postId');
    expect(postIdParam).toMatchObject({
      name: 'postId',
      in: 'path',
      required: true,
    });

    // Check PUT with inline body type
    expect(spec.paths['/api/users/{userId}/posts/{postId}'].put).toBeDefined();
    expect(
      spec.paths['/api/users/{userId}/posts/{postId}'].put?.operationId,
    ).toBe('updateUserPost');
    const updatePostBody =
      spec.paths['/api/users/{userId}/posts/{postId}'].put?.requestBody;
    expect(updatePostBody).toBeDefined();
    // Inline type should not have $ref
    const updatePostSchema =
      updatePostBody?.content['application/json'].schema;
    expect(updatePostSchema).toBeDefined();
    expect(updatePostSchema).not.toHaveProperty('$ref');
    expect(updatePostSchema).toHaveProperty('type', 'object');

    // ASSERT - Components schemas for named types
    expect(spec.components?.schemas).toBeDefined();
    expect(spec.components?.schemas?.CreateUserRequest).toBeDefined();
    expect(spec.components?.schemas?.CreateUserRequest).toMatchObject({
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
        password: { type: 'string' },
      },
      required: ['name', 'email', 'password'],
    });

    expect(spec.components?.schemas?.UpdateUserRequest).toBeDefined();
    expect(spec.components?.schemas?.UpdateUserRequest).toMatchObject({
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
        role: {
          type: 'string',
          enum: ['admin', 'user'],
        },
      },
    });

    expect(spec.components?.schemas?.CreatePostRequest).toBeDefined();
    expect(spec.components?.schemas?.CreatePostRequest).toMatchObject({
      type: 'object',
      properties: {
        title: { type: 'string' },
        content: { type: 'string' },
        published: { type: 'boolean' },
      },
      required: ['title', 'content'],
    });

    // ASSERT - All operations have responses
    expect(spec.paths['/health'].get?.responses?.['200']).toBeDefined();
    expect(spec.paths['/api/users'].get?.responses?.['200']).toBeDefined();
    expect(spec.paths['/api/users'].post?.responses?.['200']).toBeDefined();

    // Count total number of paths
    const pathCount = Object.keys(spec.paths).length;
    expect(pathCount).toBeGreaterThanOrEqual(7); // At least 7 distinct paths

    // Count total operations
    let operationCount = 0;
    for (const path of Object.values(spec.paths)) {
      operationCount += Object.keys(path).length;
    }
    expect(operationCount).toBeGreaterThanOrEqual(13); // At least 13 operations
  });

  it('should handle path filtering in complex server', async () => {
    // ARRANGE
    const options = {
      entryPoint: COMPLEX_SERVER_PATH,
      title: 'Filtered API',
      version: '1.0.0',
      ignorePaths: ['/health', '/info', '/api/users/search'],
    };

    // ACT
    const spec = await generateOpenApiSpec(options);

    // ASSERT
    expect(spec.paths['/health']).toBeUndefined();
    expect(spec.paths['/info']).toBeUndefined();
    expect(spec.paths['/api/users/search']).toBeUndefined();

    // But other paths should still be present
    expect(spec.paths['/api/users']).toBeDefined();
    expect(spec.paths['/api/users/{id}']).toBeDefined();
  });

  it('should handle wildcard path filtering', async () => {
    // ARRANGE
    const options = {
      entryPoint: COMPLEX_SERVER_PATH,
      title: 'Filtered API',
      version: '1.0.0',
      ignorePaths: ['/api/users/*/posts', '/api/users/*/posts/*'],
    };

    // ACT
    const spec = await generateOpenApiSpec(options);

    // ASSERT - Post routes should be filtered out
    expect(spec.paths['/api/users/{userId}/posts']).toBeUndefined();
    expect(spec.paths['/api/users/{userId}/posts/{postId}']).toBeUndefined();

    // But user routes should still be present
    expect(spec.paths['/api/users']).toBeDefined();
    expect(spec.paths['/api/users/{id}']).toBeDefined();
  });
});
