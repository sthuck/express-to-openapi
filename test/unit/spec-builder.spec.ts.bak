import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { buildOpenApiSpec } from '../../src/core/spec-builder.mjs';
import { RouteInfo } from '../../src/types/internal.mjs';

describe('Spec Builder', () => {
  describe('7.1: Basic Document Structure', () => {
    it('should create minimal valid OpenAPI 3.0 document', () => {
      // ARRANGE
      const routes: RouteInfo[] = [];
      const options = {
        title: 'My API',
        version: '1.0.0',
      };

      // ACT
      const spec = buildOpenApiSpec(routes, options);

      // ASSERT
      expect(spec.openapi).toBe('3.0.0');
      expect(spec.info.title).toBe('My API');
      expect(spec.info.version).toBe('1.0.0');
      expect(spec.paths).toEqual({});
    });

    it('should include optional description in info', () => {
      // ARRANGE
      const routes: RouteInfo[] = [];
      const options = {
        title: 'Test API',
        version: '2.0.0',
        description: 'API description',
      };

      // ACT
      const spec = buildOpenApiSpec(routes, options);

      // ASSERT
      expect(spec.info.description).toBe('API description');
    });

    it('should initialize components.schemas as empty object', () => {
      // ARRANGE
      const routes: RouteInfo[] = [];
      const options = {
        title: 'My API',
        version: '1.0.0',
      };

      // ACT
      const spec = buildOpenApiSpec(routes, options);

      // ASSERT
      expect(spec.components).toBeDefined();
      expect(spec.components?.schemas).toEqual({});
    });
  });

  describe('7.2: Path and Operation Creation', () => {
    it('should add simple GET route to paths', () => {
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
      const spec = buildOpenApiSpec(routes, options);

      // ASSERT
      expect(spec.paths['/users']).toBeDefined();
      expect(spec.paths['/users'].get).toBeDefined();
      expect(spec.paths['/users'].get?.operationId).toBe('getUsers');
    });

    it('should handle multiple methods on same path', () => {
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
      const spec = buildOpenApiSpec(routes, options);

      // ASSERT
      expect(spec.paths['/users'].get).toBeDefined();
      expect(spec.paths['/users'].post).toBeDefined();
      expect(spec.paths['/users'].get?.operationId).toBe('getUsers');
      expect(spec.paths['/users'].post?.operationId).toBe('createUser');
    });

    it('should handle multiple paths', () => {
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
      const spec = buildOpenApiSpec(routes, options);

      // ASSERT
      expect(Object.keys(spec.paths)).toEqual(['/users', '/posts']);
      expect(spec.paths['/users'].get?.operationId).toBe('getUsers');
      expect(spec.paths['/posts'].get?.operationId).toBe('getPosts');
    });

    it('should add default 200 response to operations', () => {
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
      const spec = buildOpenApiSpec(routes, options);

      // ASSERT
      expect(spec.paths['/users'].get?.responses).toBeDefined();
      expect(spec.paths['/users'].get?.responses?.['200']).toBeDefined();
      expect(spec.paths['/users'].get?.responses?.['200'].description).toBe(
        'Successful response',
      );
    });

    it('should handle routes without handler names', () => {
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
      const spec = buildOpenApiSpec(routes, options);

      // ASSERT
      expect(spec.paths['/users'].get).toBeDefined();
      expect(spec.paths['/users'].get?.operationId).toBeUndefined();
    });
  });

  describe('7.3: JSDoc Integration', () => {
    it('should add JSDoc description and summary to operations', () => {
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
      const spec = buildOpenApiSpec(routes, options);

      // ASSERT
      expect(spec.paths['/users'].get?.summary).toBe('Retrieve users');
      expect(spec.paths['/users'].get?.description).toBe(
        'Get all users from the database',
      );
    });

    it('should handle routes without JSDoc', () => {
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
      const spec = buildOpenApiSpec(routes, options);

      // ASSERT
      expect(spec.paths['/users'].get?.summary).toBeUndefined();
      expect(spec.paths['/users'].get?.description).toBeUndefined();
    });

    it('should handle JSDoc on arrow functions', () => {
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
      const spec = buildOpenApiSpec(routes, options);

      // ASSERT
      expect(spec.paths['/users'].get?.summary).toBe('Handle request');
      expect(spec.paths['/users'].get?.description).toBe(
        'Arrow function handler',
      );
    });
  });
});
