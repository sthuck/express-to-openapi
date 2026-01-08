import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { discoverRoutes } from '../../src/core/route-discovery.mjs';

describe('Route Discovery', () => {
  describe('Simple Routes', () => {
    it('should discover simple GET route with inline handler', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import express from 'express';
        const app = express();
        app.get('/users', (req, res) => {
          res.json({ users: [] });
        });
      `,
      );

      // ACT
      const routes = discoverRoutes(file);

      // ASSERT
      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe('/users');
      expect(routes[0].method).toBe('get');
      expect(routes[0].handlerNode).toBeDefined();
    });

    it('should discover multiple HTTP methods', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import express from 'express';
        const app = express();

        function getUsers(req, res) {}
        function createUser(req, res) {}
        function deleteUser(req, res) {}

        app.get('/users', getUsers);
        app.post('/users', createUser);
        app.delete('/users/:id', deleteUser);
      `,
      );

      // ACT
      const routes = discoverRoutes(file);

      // ASSERT
      expect(routes).toHaveLength(3);
      expect(routes.map((r) => r.method)).toEqual(['get', 'post', 'delete']);
      expect(routes.map((r) => r.path)).toEqual([
        '/users',
        '/users',
        '/users/:id',
      ]);
    });

    it('should extract handler name from named function', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import express from 'express';
        const app = express();

        function getUsers(req, res) {}

        app.get('/users', getUsers);
      `,
      );

      // ACT
      const routes = discoverRoutes(file);

      // ASSERT
      expect(routes).toHaveLength(1);
      expect(routes[0].handlerName).toBe('getUsers');
    });

    it('should handle PUT and PATCH methods', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import express from 'express';
        const app = express();

        app.put('/users/:id', (req, res) => {});
        app.patch('/users/:id', (req, res) => {});
      `,
      );

      // ACT
      const routes = discoverRoutes(file);

      // ASSERT
      expect(routes).toHaveLength(2);
      expect(routes[0].method).toBe('put');
      expect(routes[1].method).toBe('patch');
    });

    it('should handle multiple middleware and extract last handler', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import express from 'express';
        const app = express();

        function auth(req, res, next) {}
        function logger(req, res, next) {}
        function handler(req, res) {}

        app.get('/protected', auth, logger, handler);
      `,
      );

      // ACT
      const routes = discoverRoutes(file);

      // ASSERT
      expect(routes).toHaveLength(1);
      expect(routes[0].handlerName).toBe('handler');
    });

    it('should return empty array when no routes found', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import express from 'express';
        const app = express();
        app.listen(3000);
      `,
      );

      // ACT
      const routes = discoverRoutes(file);

      // ASSERT
      expect(routes).toEqual([]);
    });

    it('should ignore non-express method calls', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import express from 'express';
        const app = express();
        const fakeApp = { get: () => {} };

        app.get('/real', (req, res) => {});
        fakeApp.get('/fake', (req, res) => {});
      `,
      );

      // ACT
      const routes = discoverRoutes(file);

      // ASSERT
      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe('/real');
    });
  });

  describe('Router Mounting', () => {
    it('should follow router mounting with fixture', () => {
      // ARRANGE
      const project = new Project();
      const file = project.addSourceFileAtPath(
        'test/fixtures/router-server/main.ts',
      );

      // ACT
      const routes = discoverRoutes(file);

      // ASSERT
      expect(routes).toHaveLength(3);
      expect(routes[0].path).toBe('/api/users');
      expect(routes[0].method).toBe('get');
      expect(routes[0].handlerName).toBe('getUsers');
      expect(routes[1].path).toBe('/api/users');
      expect(routes[1].method).toBe('post');
      expect(routes[1].handlerName).toBe('createUser');
      expect(routes[2].path).toBe('/api/users/:id');
      expect(routes[2].method).toBe('get');
      expect(routes[2].handlerName).toBe('getUser');
    });

    it('should follow router mounting in memory', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import express, { Router } from 'express';
        const app = express();
        const router = Router();

        function handler(req, res) {}

        router.get('/test', handler);
        app.use('/api', router);
      `,
      );

      // ACT
      const routes = discoverRoutes(file);

      // ASSERT
      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe('/api/test');
      expect(routes[0].method).toBe('get');
      expect(routes[0].handlerName).toBe('handler');
    });
  });

  describe('Nested Routers', () => {
    it('should handle nested routers with fixture', () => {
      // ARRANGE
      const project = new Project();
      const file = project.addSourceFileAtPath(
        'test/fixtures/nested-routers/main.ts',
      );

      // ACT
      const routes = discoverRoutes(file);

      // ASSERT
      expect(routes).toHaveLength(2);
      expect(routes[0].path).toBe('/api/v1/users');
      expect(routes[0].method).toBe('get');
      expect(routes[0].handlerName).toBe('getUsers');
      expect(routes[1].path).toBe('/api/v1/users/:id');
      expect(routes[1].method).toBe('get');
      expect(routes[1].handlerName).toBe('getUser');
    });

    it('should handle nested routers in memory', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import express, { Router } from 'express';
        const app = express();
        const apiRouter = Router();
        const usersRouter = Router();
        const postsRouter = Router();

        function getUsers(req, res) {}
        function getPosts(req, res) {}

        usersRouter.get('/', getUsers);
        postsRouter.get('/', getPosts);

        apiRouter.use('/users', usersRouter);
        apiRouter.use('/posts', postsRouter);
        app.use('/api', apiRouter);
      `,
      );

      // ACT
      const routes = discoverRoutes(file);

      // ASSERT
      expect(routes).toHaveLength(2);
      expect(routes[0].path).toBe('/api/users');
      expect(routes[0].handlerName).toBe('getUsers');
      expect(routes[1].path).toBe('/api/posts');
      expect(routes[1].handlerName).toBe('getPosts');
    });
  });
});
