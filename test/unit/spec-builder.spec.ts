import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { buildOpenApiSpec } from '../../src/core/spec-builder.mjs';
import { RouteInfo } from '../../src/types/internal.mjs';

describe('Spec Builder', () => {
  describe('7.1: Basic Document Structure', () => {
    it('should create minimal valid OpenAPI 3.0 document', async () => {
      // ARRANGE
      const routes: RouteInfo[] = [];
      const options = {
        title: 'My API',
        version: '1.0.0',
      };

      // ACT
      const spec = await buildOpenApiSpec(routes, options);

      // ASSERT
      expect(spec.openapi).toBe('3.0.0');
      expect(spec.info.title).toBe('My API');
      expect(spec.info.version).toBe('1.0.0');
      expect(spec.paths).toEqual({});
    });

    it('should include optional description in info', async () => {
      // ARRANGE
      const routes: RouteInfo[] = [];
      const options = {
        title: 'Test API',
        version: '2.0.0',
        description: 'API description',
      };

      // ACT
      const spec = await buildOpenApiSpec(routes, options);

      // ASSERT
      expect(spec.info.description).toBe('API description');
    });

    it('should initialize components.schemas as empty object', async () => {
      // ARRANGE
      const routes: RouteInfo[] = [];
      const options = {
        title: 'My API',
        version: '1.0.0',
      };

      // ACT
      const spec = await buildOpenApiSpec(routes, options);

      // ASSERT
      expect(spec.components).toBeDefined();
      expect(spec.components?.schemas).toEqual({});
    });
  });

  describe('7.2: Path and Operation Creation', () => {
    it('should add simple GET route to paths', async () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `function getUsers(req, res) {}`,
      );
      const func = file.getFunctions()[0];

      const routes: RouteInfo[] = [
        {
          path: '/users',
          method: 'get',
          handlerName: 'getUsers',
          handlerNode: func,
        },
      ];
      const options = { title: 'API', version: '1.0.0' };

      // ACT
      const spec = await buildOpenApiSpec(routes, options);

      // ASSERT
      expect(spec.paths['/users']).toBeDefined();
      expect(spec.paths['/users'].get).toBeDefined();
      expect(spec.paths['/users'].get?.operationId).toBe('getUsers');
    });

    it('should handle multiple methods on same path', async () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        function getUsers(req, res) {}
        function createUser(req, res) {}
      `,
      );
      const [getFunc, postFunc] = file.getFunctions();

      const routes: RouteInfo[] = [
        {
          path: '/users',
          method: 'get',
          handlerName: 'getUsers',
          handlerNode: getFunc,
        },
        {
          path: '/users',
          method: 'post',
          handlerName: 'createUser',
          handlerNode: postFunc,
        },
      ];
      const options = { title: 'API', version: '1.0.0' };

      // ACT
      const spec = await buildOpenApiSpec(routes, options);

      // ASSERT
      expect(spec.paths['/users'].get).toBeDefined();
      expect(spec.paths['/users'].post).toBeDefined();
      expect(spec.paths['/users'].get?.operationId).toBe('getUsers');
      expect(spec.paths['/users'].post?.operationId).toBe('createUser');
    });

    it('should handle multiple paths', async () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        function getUsers(req, res) {}
        function getPosts(req, res) {}
      `,
      );
      const [usersFunc, postsFunc] = file.getFunctions();

      const routes: RouteInfo[] = [
        {
          path: '/users',
          method: 'get',
          handlerName: 'getUsers',
          handlerNode: usersFunc,
        },
        {
          path: '/posts',
          method: 'get',
          handlerName: 'getPosts',
          handlerNode: postsFunc,
        },
      ];
      const options = { title: 'API', version: '1.0.0' };

      // ACT
      const spec = await buildOpenApiSpec(routes, options);

      // ASSERT
      expect(Object.keys(spec.paths)).toEqual(['/users', '/posts']);
      expect(spec.paths['/users'].get?.operationId).toBe('getUsers');
      expect(spec.paths['/posts'].get?.operationId).toBe('getPosts');
    });

    it('should add default 200 response to operations', async () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `function getUsers(req, res) {}`,
      );
      const func = file.getFunctions()[0];

      const routes: RouteInfo[] = [
        {
          path: '/users',
          method: 'get',
          handlerName: 'getUsers',
          handlerNode: func,
        },
      ];
      const options = { title: 'API', version: '1.0.0' };

      // ACT
      const spec = await buildOpenApiSpec(routes, options);

      // ASSERT
      expect(spec.paths['/users'].get?.responses).toBeDefined();
      expect(spec.paths['/users'].get?.responses?.['200']).toBeDefined();
      expect(spec.paths['/users'].get?.responses?.['200'].description).toBe(
        'Successful response',
      );
    });

    it('should handle routes without handler names', async () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `const handler = (req, res) => {}`,
      );
      const varDecl = file.getVariableDeclarations()[0];
      const arrowFunc = varDecl.getInitializer()!;

      const routes: RouteInfo[] = [
        {
          path: '/users',
          method: 'get',
          handlerNode: arrowFunc,
        },
      ];
      const options = { title: 'API', version: '1.0.0' };

      // ACT
      const spec = await buildOpenApiSpec(routes, options);

      // ASSERT
      expect(spec.paths['/users'].get).toBeDefined();
      expect(spec.paths['/users'].get?.operationId).toBeUndefined();
    });
  });

  describe('7.3: JSDoc Integration', () => {
    it('should add JSDoc description and summary to operations', async () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        /**
         * Get all users from the database
         * @summary Retrieve users
         */
        function getUsers(req, res) {}
      `,
      );
      const func = file.getFunctions()[0];

      const routes: RouteInfo[] = [
        {
          path: '/users',
          method: 'get',
          handlerName: 'getUsers',
          handlerNode: func,
        },
      ];
      const options = { title: 'API', version: '1.0.0' };

      // ACT
      const spec = await buildOpenApiSpec(routes, options);

      // ASSERT
      expect(spec.paths['/users'].get?.summary).toBe('Retrieve users');
      expect(spec.paths['/users'].get?.description).toBe(
        'Get all users from the database',
      );
    });

    it('should handle routes without JSDoc', async () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `function getUsers(req, res) {}`,
      );
      const func = file.getFunctions()[0];

      const routes: RouteInfo[] = [
        {
          path: '/users',
          method: 'get',
          handlerName: 'getUsers',
          handlerNode: func,
        },
      ];
      const options = { title: 'API', version: '1.0.0' };

      // ACT
      const spec = await buildOpenApiSpec(routes, options);

      // ASSERT
      expect(spec.paths['/users'].get?.summary).toBeUndefined();
      expect(spec.paths['/users'].get?.description).toBeUndefined();
    });

    it('should handle JSDoc on arrow functions', async () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        /**
         * Arrow function handler
         * @summary Handle request
         */
        const handler = (req, res) => {};
      `,
      );
      const varDecl = file.getVariableDeclarations()[0];
      const arrowFunc = varDecl.getInitializer()!;

      const routes: RouteInfo[] = [
        {
          path: '/users',
          method: 'get',
          handlerNode: arrowFunc,
        },
      ];
      const options = { title: 'API', version: '1.0.0' };

      // ACT
      const spec = await buildOpenApiSpec(routes, options);

      // ASSERT
      expect(spec.paths['/users'].get?.summary).toBe('Handle request');
      expect(spec.paths['/users'].get?.description).toBe(
        'Arrow function handler',
      );
    });
  });

  describe('7.5: Query Parameters', () => {
    it('should extract inline query parameters', async () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Request, Response } from 'express';
        function getUsers(
          req: Request<{}, {}, {}, { page: number; limit: number }>,
          res: Response
        ) {}
      `,
      );
      const func = file.getFunctions()[0];

      const routes: RouteInfo[] = [
        {
          path: '/users',
          method: 'get',
          handlerName: 'getUsers',
          handlerNode: func,
        },
      ];
      const options = { title: 'API', version: '1.0.0' };

      // ACT
      const spec = await buildOpenApiSpec(routes, options);

      // ASSERT
      const params = spec.paths['/users'].get?.parameters;
      expect(params).toHaveLength(2);
      expect(params?.[0]).toMatchObject({
        name: 'page',
        in: 'query',
        required: false,
        schema: { type: 'number' },
      });
      expect(params?.[1]).toMatchObject({
        name: 'limit',
        in: 'query',
        required: false,
        schema: { type: 'number' },
      });
    });

    it('should handle named query parameter types', async () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Request, Response } from 'express';
        interface PaginationQuery {
          page: number;
          limit: number;
        }
        function getUsers(
          req: Request<{}, {}, {}, PaginationQuery>,
          res: Response
        ) {}
      `,
      );
      const func = file.getFunctions()[0];

      const routes: RouteInfo[] = [
        {
          path: '/users',
          method: 'get',
          handlerName: 'getUsers',
          handlerNode: func,
        },
      ];
      const options = { title: 'API', version: '1.0.0' };

      // ACT
      const spec = await buildOpenApiSpec(routes, options);

      // ASSERT
      const params = spec.paths['/users'].get?.parameters;
      expect(params).toHaveLength(2);
      expect(params?.[0]).toMatchObject({
        name: 'page',
        in: 'query',
        required: false,
      });
      expect(params?.[1]).toMatchObject({
        name: 'limit',
        in: 'query',
        required: false,
      });
    });

    it('should handle routes without query parameters', async () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Request, Response } from 'express';
        function getUsers(req: Request, res: Response) {}
      `,
      );
      const func = file.getFunctions()[0];

      const routes: RouteInfo[] = [
        {
          path: '/users',
          method: 'get',
          handlerName: 'getUsers',
          handlerNode: func,
        },
      ];
      const options = { title: 'API', version: '1.0.0' };

      // ACT
      const spec = await buildOpenApiSpec(routes, options);

      // ASSERT
      const params = spec.paths['/users'].get?.parameters;
      expect(params).toBeUndefined();
    });

    it('should combine path and query parameters', async () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Request, Response } from 'express';
        function getUser(
          req: Request<{ id: string }, {}, {}, { include: string }>,
          res: Response
        ) {}
      `,
      );
      const func = file.getFunctions()[0];

      const routes: RouteInfo[] = [
        {
          path: '/users/:id',
          method: 'get',
          handlerName: 'getUser',
          handlerNode: func,
        },
      ];
      const options = { title: 'API', version: '1.0.0' };

      // ACT
      const spec = await buildOpenApiSpec(routes, options);

      // ASSERT
      const params = spec.paths['/users/{id}'].get?.parameters;
      expect(params).toHaveLength(2);
      expect(params?.[0]).toMatchObject({
        name: 'id',
        in: 'path',
        required: true,
      });
      expect(params?.[1]).toMatchObject({
        name: 'include',
        in: 'query',
        required: false,
      });
    });
  });

  describe('7.6: Request Body', () => {
    it('should add requestBody for POST with inline body type', async () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Request, Response } from 'express';
        function createUser(
          req: Request<{}, {}, { name: string; email: string }>,
          res: Response
        ) {}
      `,
      );
      const func = file.getFunctions()[0];

      const routes: RouteInfo[] = [
        {
          path: '/users',
          method: 'post',
          handlerName: 'createUser',
          handlerNode: func,
        },
      ];
      const options = { title: 'API', version: '1.0.0' };

      // ACT
      const spec = await buildOpenApiSpec(routes, options);

      // ASSERT
      const requestBody = spec.paths['/users'].post?.requestBody;
      expect(requestBody).toBeDefined();
      expect(requestBody?.required).toBe(true);
      expect(requestBody?.content['application/json'].schema).toMatchObject({
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
        },
        required: ['name', 'email'],
      });
    });

    it('should add requestBody for POST with named body type', async () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Request, Response } from 'express';
        interface CreateUserRequest {
          name: string;
          email: string;
        }
        function createUser(
          req: Request<{}, {}, CreateUserRequest>,
          res: Response
        ) {}
      `,
      );
      const func = file.getFunctions()[0];

      const routes: RouteInfo[] = [
        {
          path: '/users',
          method: 'post',
          handlerName: 'createUser',
          handlerNode: func,
        },
      ];
      const options = { title: 'API', version: '1.0.0' };

      // ACT
      const spec = await buildOpenApiSpec(routes, options);

      // ASSERT
      const requestBody = spec.paths['/users'].post?.requestBody;
      expect(requestBody).toBeDefined();
      expect(requestBody?.content['application/json'].schema).toEqual({
        $ref: '#/components/schemas/CreateUserRequest',
      });
      expect(spec.components?.schemas?.CreateUserRequest).toBeDefined();
      expect(spec.components?.schemas?.CreateUserRequest).toMatchObject({
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
        },
        required: ['name', 'email'],
      });
    });

    it('should not add requestBody for GET requests', async () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Request, Response } from 'express';
        function getUsers(req: Request, res: Response) {}
      `,
      );
      const func = file.getFunctions()[0];

      const routes: RouteInfo[] = [
        {
          path: '/users',
          method: 'get',
          handlerName: 'getUsers',
          handlerNode: func,
        },
      ];
      const options = { title: 'API', version: '1.0.0' };

      // ACT
      const spec = await buildOpenApiSpec(routes, options);

      // ASSERT
      expect(spec.paths['/users'].get?.requestBody).toBeUndefined();
    });

    it('should add requestBody for PUT with body type', async () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Request, Response } from 'express';
        function updateUser(
          req: Request<{}, {}, { name: string }>,
          res: Response
        ) {}
      `,
      );
      const func = file.getFunctions()[0];

      const routes: RouteInfo[] = [
        {
          path: '/users/:id',
          method: 'put',
          handlerName: 'updateUser',
          handlerNode: func,
        },
      ];
      const options = { title: 'API', version: '1.0.0' };

      // ACT
      const spec = await buildOpenApiSpec(routes, options);

      // ASSERT
      const requestBody = spec.paths['/users/{id}'].put?.requestBody;
      expect(requestBody).toBeDefined();
      expect(requestBody?.content['application/json'].schema).toMatchObject({
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      });
    });

    it('should add requestBody for PATCH with body type', async () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Request, Response } from 'express';
        function patchUser(
          req: Request<{}, {}, { name?: string }>,
          res: Response
        ) {}
      `,
      );
      const func = file.getFunctions()[0];

      const routes: RouteInfo[] = [
        {
          path: '/users/:id',
          method: 'patch',
          handlerName: 'patchUser',
          handlerNode: func,
        },
      ];
      const options = { title: 'API', version: '1.0.0' };

      // ACT
      const spec = await buildOpenApiSpec(routes, options);

      // ASSERT
      const requestBody = spec.paths['/users/{id}'].patch?.requestBody;
      expect(requestBody).toBeDefined();
      expect(requestBody?.content['application/json']).toBeDefined();
    });
  });

  describe('7.8: Schema Deduplication', () => {
    it('should reuse same schema when same named type is used in multiple routes', async () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Request, Response } from 'express';
        interface User {
          name: string;
          email: string;
        }
        function createUser(req: Request<{}, {}, User>, res: Response) {}
        function updateUser(req: Request<{}, {}, User>, res: Response) {}
      `,
      );
      const [createFunc, updateFunc] = file.getFunctions();

      const routes: RouteInfo[] = [
        {
          path: '/users',
          method: 'post',
          handlerName: 'createUser',
          handlerNode: createFunc,
        },
        {
          path: '/users/:id',
          method: 'put',
          handlerName: 'updateUser',
          handlerNode: updateFunc,
        },
      ];
      const options = { title: 'API', version: '1.0.0' };

      // ACT
      const spec = await buildOpenApiSpec(routes, options);

      // ASSERT
      // Should only have one User schema
      expect(Object.keys(spec.components?.schemas || {})).toEqual(['User']);
      // Both routes should reference the same schema
      expect(spec.paths['/users'].post?.requestBody?.content['application/json'].schema).toEqual({
        $ref: '#/components/schemas/User',
      });
      expect(spec.paths['/users/{id}'].put?.requestBody?.content['application/json'].schema).toEqual({
        $ref: '#/components/schemas/User',
      });
    });

    it('should handle empty components.schemas when no named types are used', async () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Request, Response } from 'express';
        function createUser(req: Request<{}, {}, { name: string }>, res: Response) {}
        function updateUser(req: Request<{}, {}, { email: string }>, res: Response) {}
      `,
      );
      const [createFunc, updateFunc] = file.getFunctions();

      const routes: RouteInfo[] = [
        {
          path: '/users',
          method: 'post',
          handlerName: 'createUser',
          handlerNode: createFunc,
        },
        {
          path: '/users/:id',
          method: 'put',
          handlerName: 'updateUser',
          handlerNode: updateFunc,
        },
      ];
      const options = { title: 'API', version: '1.0.0' };

      // ACT
      const spec = await buildOpenApiSpec(routes, options);

      // ASSERT
      // Should have no schemas since all types are inline
      expect(Object.keys(spec.components?.schemas || {})).toEqual([]);
    });

    it('should handle multiple different named types', async () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Request, Response } from 'express';
        interface CreateUserRequest {
          name: string;
        }
        interface UpdateUserRequest {
          email: string;
        }
        function createUser(req: Request<{}, {}, CreateUserRequest>, res: Response) {}
        function updateUser(req: Request<{}, {}, UpdateUserRequest>, res: Response) {}
      `,
      );
      const [createFunc, updateFunc] = file.getFunctions();

      const routes: RouteInfo[] = [
        {
          path: '/users',
          method: 'post',
          handlerName: 'createUser',
          handlerNode: createFunc,
        },
        {
          path: '/users/:id',
          method: 'put',
          handlerName: 'updateUser',
          handlerNode: updateFunc,
        },
      ];
      const options = { title: 'API', version: '1.0.0' };

      // ACT
      const spec = await buildOpenApiSpec(routes, options);

      // ASSERT
      // Should have both schemas
      const schemaKeys = Object.keys(spec.components?.schemas || {}).sort();
      expect(schemaKeys).toEqual(['CreateUserRequest', 'UpdateUserRequest']);
    });
  });

  describe('7.9: Integration Test', () => {
    it('should build complete OpenAPI spec with all features', async () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Request, Response } from 'express';

        interface CreateUserBody {
          name: string;
          email: string;
        }

        interface PaginationQuery {
          page: number;
          limit: number;
        }

        /**
         * Create a new user in the system
         * @summary Create user
         */
        function createUser(
          req: Request<{}, {}, CreateUserBody>,
          res: Response
        ) {
          res.json({ id: 1 });
        }

        /**
         * Get user by ID
         * @summary Retrieve user
         */
        function getUser(
          req: Request<{ id: string }>,
          res: Response
        ) {
          res.json({ id: 1, name: 'John' });
        }

        /**
         * List all users with pagination
         * @summary List users
         */
        function listUsers(
          req: Request<{}, {}, {}, PaginationQuery>,
          res: Response
        ) {
          res.json([]);
        }

        /**
         * Update user information
         */
        function updateUser(
          req: Request<{ id: string }, {}, { name?: string }, { notify: boolean }>,
          res: Response
        ) {
          res.json({ id: 1 });
        }
      `,
      );
      const [createFunc, getFunc, listFunc, updateFunc] = file.getFunctions();

      const routes: RouteInfo[] = [
        {
          path: '/users',
          method: 'post',
          handlerName: 'createUser',
          handlerNode: createFunc,
        },
        {
          path: '/users/:id',
          method: 'get',
          handlerName: 'getUser',
          handlerNode: getFunc,
        },
        {
          path: '/users',
          method: 'get',
          handlerName: 'listUsers',
          handlerNode: listFunc,
        },
        {
          path: '/users/:id',
          method: 'put',
          handlerName: 'updateUser',
          handlerNode: updateFunc,
        },
      ];

      const options = {
        title: 'Test API',
        version: '1.0.0',
        description: 'A comprehensive test API',
      };

      // ACT
      const spec = await buildOpenApiSpec(routes, options);

      // ASSERT
      // Verify basic structure
      expect(spec.openapi).toBe('3.0.0');
      expect(spec.info).toMatchObject({
        title: 'Test API',
        version: '1.0.0',
        description: 'A comprehensive test API',
      });

      // Verify POST /users (with named body type and JSDoc)
      const createUserOp = spec.paths['/users'].post;
      expect(createUserOp).toBeDefined();
      expect(createUserOp?.operationId).toBe('createUser');
      expect(createUserOp?.summary).toBe('Create user');
      expect(createUserOp?.description).toBe('Create a new user in the system');
      expect(createUserOp?.requestBody?.content['application/json'].schema).toEqual({
        $ref: '#/components/schemas/CreateUserBody',
      });

      // Verify GET /users/:id (with path params and JSDoc)
      const getUserOp = spec.paths['/users/{id}'].get;
      expect(getUserOp).toBeDefined();
      expect(getUserOp?.operationId).toBe('getUser');
      expect(getUserOp?.summary).toBe('Retrieve user');
      expect(getUserOp?.parameters).toHaveLength(1);
      expect(getUserOp?.parameters?.[0]).toMatchObject({
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string' },
      });

      // Verify GET /users (with named query params)
      const listUsersOp = spec.paths['/users'].get;
      expect(listUsersOp).toBeDefined();
      expect(listUsersOp?.operationId).toBe('listUsers');
      expect(listUsersOp?.parameters).toHaveLength(2);
      expect(listUsersOp?.parameters?.[0]).toMatchObject({
        name: 'page',
        in: 'query',
        required: false,
      });
      expect(listUsersOp?.parameters?.[1]).toMatchObject({
        name: 'limit',
        in: 'query',
        required: false,
      });

      // Verify PUT /users/:id (with path params, inline body, and query params)
      const updateUserOp = spec.paths['/users/{id}'].put;
      expect(updateUserOp).toBeDefined();
      expect(updateUserOp?.operationId).toBe('updateUser');
      expect(updateUserOp?.parameters).toHaveLength(2); // 1 path + 1 query
      expect(updateUserOp?.parameters?.[0]).toMatchObject({
        name: 'id',
        in: 'path',
      });
      expect(updateUserOp?.parameters?.[1]).toMatchObject({
        name: 'notify',
        in: 'query',
      });
      expect(updateUserOp?.requestBody).toBeDefined();

      // Verify components.schemas has named types
      expect(spec.components?.schemas?.CreateUserBody).toBeDefined();
      expect(spec.components?.schemas?.CreateUserBody).toMatchObject({
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
        },
      });

      // Verify all operations have responses
      expect(createUserOp?.responses?.['200']).toBeDefined();
      expect(getUserOp?.responses?.['200']).toBeDefined();
      expect(listUsersOp?.responses?.['200']).toBeDefined();
      expect(updateUserOp?.responses?.['200']).toBeDefined();
    });
  });

  describe('7.4: Path Parameters', () => {
    it('should convert Express path params to OpenAPI format', async () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `function getUser(req, res) {}`,
      );
      const func = file.getFunctions()[0];

      const routes: RouteInfo[] = [
        {
          path: '/users/:id',
          method: 'get',
          handlerName: 'getUser',
          handlerNode: func,
        },
      ];
      const options = { title: 'API', version: '1.0.0' };

      // ACT
      const spec = await buildOpenApiSpec(routes, options);

      // ASSERT
      expect(spec.paths['/users/{id}']).toBeDefined();
      expect(spec.paths['/users/:id']).toBeUndefined();
    });

    it('should extract path parameter schema from type info', async () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Request, Response } from 'express';
        function getUser(req: Request<{ id: string }>, res: Response) {}
      `,
      );
      const func = file.getFunctions()[0];

      const routes: RouteInfo[] = [
        {
          path: '/users/:id',
          method: 'get',
          handlerName: 'getUser',
          handlerNode: func,
        },
      ];
      const options = { title: 'API', version: '1.0.0' };

      // ACT
      const spec = await buildOpenApiSpec(routes, options);

      // ASSERT
      const params = spec.paths['/users/{id}'].get?.parameters;
      expect(params).toHaveLength(1);
      expect(params?.[0]).toMatchObject({
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string' },
      });
    });

    it('should handle multiple path parameters', async () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Request, Response } from 'express';
        function getPost(
          req: Request<{ userId: string; postId: string }>,
          res: Response
        ) {}
      `,
      );
      const func = file.getFunctions()[0];

      const routes: RouteInfo[] = [
        {
          path: '/users/:userId/posts/:postId',
          method: 'get',
          handlerName: 'getPost',
          handlerNode: func,
        },
      ];
      const options = { title: 'API', version: '1.0.0' };

      // ACT
      const spec = await buildOpenApiSpec(routes, options);

      // ASSERT
      const params = spec.paths['/users/{userId}/posts/{postId}'].get
        ?.parameters;
      expect(params).toHaveLength(2);
      expect(params?.[0]).toMatchObject({
        name: 'userId',
        in: 'path',
        required: true,
      });
      expect(params?.[1]).toMatchObject({
        name: 'postId',
        in: 'path',
        required: true,
      });
    });

    it('should handle routes with path params but no type info', async () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `function getUser(req, res) {}`,
      );
      const func = file.getFunctions()[0];

      const routes: RouteInfo[] = [
        {
          path: '/users/:id',
          method: 'get',
          handlerName: 'getUser',
          handlerNode: func,
        },
      ];
      const options = { title: 'API', version: '1.0.0' };

      // ACT
      const spec = await buildOpenApiSpec(routes, options);

      // ASSERT
      const params = spec.paths['/users/{id}'].get?.parameters;
      expect(params).toHaveLength(1);
      expect(params?.[0]).toMatchObject({
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string' }, // Default to string
      });
    });

    it('should handle Express custom parameter patterns', async () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Request, Response } from 'express';
        function getRepo(req: Request<{ remoteRepoUrl: string }>, res: Response) {}
        function getUser(req: Request<{ id: string }>, res: Response) {}
        function getPost(req: Request<{ slug: string }>, res: Response) {}
      `,
      );
      const [getRepoFunc, getUserFunc, getPostFunc] = file.getFunctions();

      const routes: RouteInfo[] = [
        {
          path: '/v2/:remoteRepoUrl(*)', // Match anything including slashes
          method: 'get',
          handlerName: 'getRepo',
          handlerNode: getRepoFunc,
        },
        {
          path: '/users/:id(\\d+)', // Match digits only
          method: 'get',
          handlerName: 'getUser',
          handlerNode: getUserFunc,
        },
        {
          path: '/posts/:slug([a-z-]+)?', // Optional with pattern
          method: 'get',
          handlerName: 'getPost',
          handlerNode: getPostFunc,
        },
      ];
      const options = { title: 'API', version: '1.0.0' };

      // ACT
      const spec = await buildOpenApiSpec(routes, options);

      // ASSERT
      // First route: :remoteRepoUrl(*) should convert to {remoteRepoUrl}
      expect(spec.paths['/v2/{remoteRepoUrl}']).toBeDefined();
      expect(spec.paths['/v2/:remoteRepoUrl(*)']).toBeUndefined();
      const repoParams = spec.paths['/v2/{remoteRepoUrl}'].get?.parameters;
      expect(repoParams).toHaveLength(1);
      expect(repoParams?.[0]).toMatchObject({
        name: 'remoteRepoUrl',
        in: 'path',
        required: true,
        schema: { type: 'string' },
      });

      // Second route: :id(\\d+) should convert to {id}
      expect(spec.paths['/users/{id}']).toBeDefined();
      expect(spec.paths['/users/:id(\\d+)']).toBeUndefined();
      const userParams = spec.paths['/users/{id}'].get?.parameters;
      expect(userParams).toHaveLength(1);
      expect(userParams?.[0]).toMatchObject({
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string' },
      });

      // Third route: :slug([a-z-]+)? should convert to {slug}
      expect(spec.paths['/posts/{slug}']).toBeDefined();
      expect(spec.paths['/posts/:slug([a-z-]+)?']).toBeUndefined();
      const postParams = spec.paths['/posts/{slug}'].get?.parameters;
      expect(postParams).toHaveLength(1);
      expect(postParams?.[0]).toMatchObject({
        name: 'slug',
        in: 'path',
        required: true,
        schema: { type: 'string' },
      });
    });
  });

  describe('Response Body Extraction', () => {
    it('should extract inline response body type', async () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Request, Response } from 'express';
        function getUser(
          req: Request<{ id: string }, { id: string; name: string; email: string }>,
          res: Response
        ) {}
      `,
      );
      const func = file.getFunctions()[0];

      const routes: RouteInfo[] = [
        {
          path: '/users/:id',
          method: 'get',
          handlerName: 'getUser',
          handlerNode: func,
        },
      ];
      const options = { title: 'API', version: '1.0.0' };

      // ACT
      const spec = await buildOpenApiSpec(routes, options);

      // ASSERT
      const response = spec.paths['/users/{id}'].get?.responses?.['200'];
      expect(response).toBeDefined();
      expect(response?.description).toBe('Successful response');
      expect(response?.content).toBeDefined();
      expect(response?.content?.['application/json'].schema).toMatchObject({
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
        },
        required: ['id', 'name', 'email'],
      });
    });

    it('should extract named response body type', async () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Request, Response } from 'express';
        interface UserResponse {
          id: string;
          name: string;
          email: string;
        }
        function getUser(
          req: Request<{ id: string }, UserResponse>,
          res: Response
        ) {}
      `,
      );
      const func = file.getFunctions()[0];

      const routes: RouteInfo[] = [
        {
          path: '/users/:id',
          method: 'get',
          handlerName: 'getUser',
          handlerNode: func,
        },
      ];
      const options = { title: 'API', version: '1.0.0' };

      // ACT
      const spec = await buildOpenApiSpec(routes, options);

      // ASSERT
      const response = spec.paths['/users/{id}'].get?.responses?.['200'];
      expect(response).toBeDefined();
      expect(response?.description).toBe('Successful response');
      expect(response?.content?.['application/json'].schema).toEqual({
        $ref: '#/components/schemas/UserResponse',
      });
      expect(spec.components?.schemas?.UserResponse).toBeDefined();
      expect(spec.components?.schemas?.UserResponse).toMatchObject({
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
        },
        required: ['id', 'name', 'email'],
      });
    });

    it('should handle routes without response body type', async () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Request, Response } from 'express';
        function getUsers(req: Request, res: Response) {}
      `,
      );
      const func = file.getFunctions()[0];

      const routes: RouteInfo[] = [
        {
          path: '/users',
          method: 'get',
          handlerName: 'getUsers',
          handlerNode: func,
        },
      ];
      const options = { title: 'API', version: '1.0.0' };

      // ACT
      const spec = await buildOpenApiSpec(routes, options);

      // ASSERT
      const response = spec.paths['/users'].get?.responses?.['200'];
      expect(response).toBeDefined();
      expect(response?.description).toBe('Successful response');
      expect(response?.content).toBeUndefined();
    });

    it('should handle POST with both request and response body types', async () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Request, Response } from 'express';
        interface CreateUserRequest {
          name: string;
          email: string;
        }
        interface UserResponse {
          id: string;
          name: string;
          email: string;
          createdAt: string;
        }
        function createUser(
          req: Request<{}, UserResponse, CreateUserRequest>,
          res: Response
        ) {}
      `,
      );
      const func = file.getFunctions()[0];

      const routes: RouteInfo[] = [
        {
          path: '/users',
          method: 'post',
          handlerName: 'createUser',
          handlerNode: func,
        },
      ];
      const options = { title: 'API', version: '1.0.0' };

      // ACT
      const spec = await buildOpenApiSpec(routes, options);

      // ASSERT
      const operation = spec.paths['/users'].post;
      expect(operation).toBeDefined();

      // Check request body
      expect(operation?.requestBody?.content['application/json'].schema).toEqual({
        $ref: '#/components/schemas/CreateUserRequest',
      });

      // Check response body
      const response = operation?.responses?.['200'];
      expect(response?.description).toBe('Successful response');
      expect(response?.content?.['application/json'].schema).toEqual({
        $ref: '#/components/schemas/UserResponse',
      });

      // Check both schemas are in components
      expect(spec.components?.schemas?.CreateUserRequest).toBeDefined();
      expect(spec.components?.schemas?.UserResponse).toBeDefined();
    });

    it('should handle array response types', async () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Request, Response } from 'express';
        interface User {
          id: string;
          name: string;
        }
        function listUsers(
          req: Request<{}, User[]>,
          res: Response
        ) {}
      `,
      );
      const func = file.getFunctions()[0];

      const routes: RouteInfo[] = [
        {
          path: '/users',
          method: 'get',
          handlerName: 'listUsers',
          handlerNode: func,
        },
      ];
      const options = { title: 'API', version: '1.0.0' };

      // ACT
      const spec = await buildOpenApiSpec(routes, options);

      // ASSERT
      const response = spec.paths['/users'].get?.responses?.['200'];
      expect(response).toBeDefined();
      expect(response?.content).toBeDefined();
      // The schema should be an array
      const schema = response?.content?.['application/json'].schema;
      expect(schema).toBeDefined();
    });

    it('should properly handle response type with nested named type', async () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Request, Response } from 'express';

        interface Address {
          street: string;
          city: string;
        }

        interface UserResponse {
          id: string;
          name: string;
          address: Address;
        }

        function getUser(req: Request, res: Response<UserResponse>) {}
      `,
      );
      const func = file.getFunctions()[0];

      const routes: RouteInfo[] = [
        {
          path: '/users/:id',
          method: 'get',
          handlerName: 'getUser',
          handlerNode: func,
        },
      ];
      const options = { title: 'API', version: '1.0.0' };

      // ACT
      const spec = await buildOpenApiSpec(routes, options);

      // ASSERT
      const response = spec.paths['/users/{id}'].get?.responses?.['200'];
      expect(response).toBeDefined();
      expect(response?.content?.['application/json'].schema).toEqual({
        $ref: '#/components/schemas/UserResponse',
      });

      // The UserResponse schema should have properly resolved nested Address type
      const userResponseSchema = spec.components?.schemas?.UserResponse;
      expect(userResponseSchema).toBeDefined();
      expect(userResponseSchema?.properties?.id).toEqual({ type: 'string' });
      expect(userResponseSchema?.properties?.name).toEqual({ type: 'string' });

      // The address property should be properly structured, not just "Address" as a string
      const addressProp = userResponseSchema?.properties?.address;
      expect(addressProp).toBeDefined();
      expect(addressProp?.type).toBe('object');
      expect(addressProp?.properties?.street).toEqual({ type: 'string' });
      expect(addressProp?.properties?.city).toEqual({ type: 'string' });
    });

    it('should properly handle request body with nested named type', async () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Request, Response } from 'express';

        interface Address {
          street: string;
          city: string;
        }

        interface CreateUserRequest {
          name: string;
          email: string;
          address: Address;
        }

        function createUser(req: Request<{}, {}, CreateUserRequest>, res: Response) {}
      `,
      );
      const func = file.getFunctions()[0];

      const routes: RouteInfo[] = [
        {
          path: '/users',
          method: 'post',
          handlerName: 'createUser',
          handlerNode: func,
        },
      ];
      const options = { title: 'API', version: '1.0.0' };

      // ACT
      const spec = await buildOpenApiSpec(routes, options);

      // ASSERT
      const requestBody = spec.paths['/users'].post?.requestBody;
      expect(requestBody?.content['application/json'].schema).toEqual({
        $ref: '#/components/schemas/CreateUserRequest',
      });

      // The CreateUserRequest schema should have properly resolved nested Address type
      const createUserSchema = spec.components?.schemas?.CreateUserRequest;
      expect(createUserSchema).toBeDefined();
      expect(createUserSchema?.properties?.name).toEqual({ type: 'string' });
      expect(createUserSchema?.properties?.email).toEqual({ type: 'string' });

      // The address property should be properly structured, not just "Address" as a string
      const addressProp = createUserSchema?.properties?.address;
      expect(addressProp).toBeDefined();
      expect(addressProp?.type).toBe('object');
      expect(addressProp?.properties?.street).toEqual({ type: 'string' });
      expect(addressProp?.properties?.city).toEqual({ type: 'string' });
    });
  });
});
