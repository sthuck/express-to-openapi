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

    it('should mount router at root when path is not provided', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import express, { Router } from 'express';
        const app = express();
        const router = Router();

        function handler(req, res) {}

        router.get('/users', handler);
        app.use(router);
      `,
      );

      // ACT
      const routes = discoverRoutes(file);

      // ASSERT
      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe('/users');
      expect(routes[0].method).toBe('get');
      expect(routes[0].handlerName).toBe('handler');
    });

    it('should ignore middleware (non-router) in app.use()', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import express from 'express';
        const app = express();

        function authMiddleware(req, res, next) {
          next();
        }

        function handler(req, res) {}

        app.use(authMiddleware);
        app.get('/users', handler);
      `,
      );

      // ACT
      const routes = discoverRoutes(file);

      // ASSERT
      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe('/users');
      expect(routes[0].method).toBe('get');
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

  describe('Function-Based Routes', () => {
    it('should discover routes defined in setup function', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import express, { Application } from 'express';
        const app = express();

        function setupApp(app: Application) {
          function handler(req, res) {}
          app.get('/users', handler);
        }

        setupApp(app);
      `,
      );

      // ACT
      const routes = discoverRoutes(file);

      // ASSERT
      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe('/users');
      expect(routes[0].method).toBe('get');
      expect(routes[0].handlerName).toBe('handler');
    });

    it('should handle different parameter names', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import express, { Application } from 'express';
        const app = express();

        function configureRoutes(application: Application) {
          function handler(req, res) {}
          application.get('/products', handler);
        }

        configureRoutes(app);
      `,
      );

      // ACT
      const routes = discoverRoutes(file);

      // ASSERT
      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe('/products');
      expect(routes[0].method).toBe('get');
    });

    it('should discover routes in imported setup function', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });

      project.createSourceFile(
        'setupApp.ts',
        `
        import { Application } from 'express';

        export function setupApp(app: Application) {
          function healthCheck(req, res) {}
          app.get('/health', healthCheck);
        }
      `,
      );

      const file = project.createSourceFile(
        'main.ts',
        `
        import express from 'express';
        import { setupApp } from './setupApp';

        const app = express();
        setupApp(app);
      `,
      );

      // ACT
      const routes = discoverRoutes(file);

      // ASSERT
      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe('/health');
      expect(routes[0].handlerName).toBe('healthCheck');
    });

    it('should handle nested function calls', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import express, { Application } from 'express';
        const app = express();

        function setupRoutes(app: Application) {
          function handler(req, res) {}
          app.get('/nested', handler);
        }

        function setupApp(app: Application) {
          setupRoutes(app);
        }

        setupApp(app);
      `,
      );

      // ACT
      const routes = discoverRoutes(file);

      // ASSERT
      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe('/nested');
      expect(routes[0].handlerName).toBe('handler');
    });

    it('should handle router mounting within setup function', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import express, { Application, Router } from 'express';
        const app = express();
        const userRouter = Router();

        function getUsers(req, res) {}
        userRouter.get('/', getUsers);

        function setupApp(app: Application) {
          app.use('/api/users', userRouter);
        }

        setupApp(app);
      `,
      );

      // ACT
      const routes = discoverRoutes(file);

      // ASSERT
      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe('/api/users');
      expect(routes[0].handlerName).toBe('getUsers');
    });

    it('should handle multiple routes in setup function', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import express, { Application } from 'express';
        const app = express();

        function setupApp(app: Application) {
          function getUsers(req, res) {}
          function createUser(req, res) {}
          function deleteUser(req, res) {}

          app.get('/users', getUsers);
          app.post('/users', createUser);
          app.delete('/users/:id', deleteUser);
        }

        setupApp(app);
      `,
      );

      // ACT
      const routes = discoverRoutes(file);

      // ASSERT
      expect(routes).toHaveLength(3);
      expect(routes[0].method).toBe('get');
      expect(routes[1].method).toBe('post');
      expect(routes[2].method).toBe('delete');
    });

    it('should handle arrow function setup', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import express, { Application } from 'express';
        const app = express();

        const setupApp = (app: Application) => {
          function handler(req, res) {}
          app.get('/arrow', handler);
        };

        setupApp(app);
      `,
      );

      // ACT
      const routes = discoverRoutes(file);

      // ASSERT
      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe('/arrow');
      expect(routes[0].handlerName).toBe('handler');
    });
  });

  describe('Wrapped Handlers', () => {
    it('should unwrap asyncHandler to get actual handler function', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import express, { Request, Response } from 'express';
        const app = express();

        // Common async wrapper pattern
        const asyncHandler = (fn: Function) => (req: Request, res: Response, next: Function) => {
          Promise.resolve(fn(req, res, next)).catch(next);
        };

        // Actual handler with type information
        async function getUser(req: Request<{ id: string }>, res: Response) {
          const userId = req.params.id;
          res.json({ id: userId });
        }

        // Wrapped in asyncHandler
        app.get('/users/:id', asyncHandler(getUser));
      `,
      );

      // ACT
      const routes = discoverRoutes(file);

      // ASSERT
      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe('/users/:id');
      expect(routes[0].method).toBe('get');
      // Should resolve to 'getUser', not 'asyncHandler'
      expect(routes[0].handlerName).toBe('getUser');
    });

    it('should handle multiple wrapper levels', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import express, { Request, Response } from 'express';
        const app = express();

        const asyncHandler = (fn: Function) => (req: Request, res: Response, next: Function) => {
          Promise.resolve(fn(req, res, next)).catch(next);
        };

        const authMiddleware = (fn: Function) => (req: Request, res: Response, next: Function) => {
          // auth check
          return fn(req, res, next);
        };

        async function createUser(req: Request<{}, {}, { name: string }>, res: Response) {
          res.json({ name: req.body.name });
        }

        // Multiple wrappers: authMiddleware(asyncHandler(createUser))
        app.post('/users', authMiddleware(asyncHandler(createUser)));
      `,
      );

      // ACT
      const routes = discoverRoutes(file);

      // ASSERT
      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe('/users');
      expect(routes[0].method).toBe('post');
      // Should unwrap to innermost handler 'createUser'
      expect(routes[0].handlerName).toBe('createUser');
    });

    it('should handle inline wrapped handlers', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import express, { Request, Response } from 'express';
        const app = express();

        const asyncHandler = (fn: Function) => (req: Request, res: Response, next: Function) => {
          Promise.resolve(fn(req, res, next)).catch(next);
        };

        // Named function wrapped inline
        app.get('/posts', asyncHandler(async function getPosts(req: Request, res: Response) {
          res.json({ posts: [] });
        }));
      `,
      );

      // ACT
      const routes = discoverRoutes(file);

      // ASSERT
      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe('/posts');
      expect(routes[0].method).toBe('get');
      expect(routes[0].handlerName).toBe('getPosts');
    });

    it('should handle wrapped arrow functions with identifier', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import express, { Request, Response } from 'express';
        const app = express();

        const asyncHandler = (fn: Function) => (req: Request, res: Response, next: Function) => {
          Promise.resolve(fn(req, res, next)).catch(next);
        };

        const deleteUser = async (req: Request<{ id: string }>, res: Response) => {
          res.status(204).send();
        };

        app.delete('/users/:id', asyncHandler(deleteUser));
      `,
      );

      // ACT
      const routes = discoverRoutes(file);

      // ASSERT
      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe('/users/:id');
      expect(routes[0].method).toBe('delete');
      expect(routes[0].handlerName).toBe('deleteUser');
    });
  });
});
