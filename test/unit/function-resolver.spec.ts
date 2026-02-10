import { describe, it, expect } from 'vitest';
import { Project, SyntaxKind } from 'ts-morph';
import { resolveHandler } from '../../src/ast/function-resolver.mjs';

describe('Function Resolver', () => {
  it('should resolve inline arrow function', () => {
    // ARRANGE
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile(
      'test.ts',
      `
      import express from 'express';
      const app = express();
      app.get('/', (req, res) => {
        res.send('Hello');
      });
    `,
    );
    const callExpr = file
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .find((call) => call.getExpression().getText() === 'app.get');
    expect(callExpr).toBeDefined();

    // ACT
    const handler = resolveHandler(callExpr!);

    // ASSERT
    expect(handler).toBeDefined();
    expect(handler?.kind).toBe(SyntaxKind.ArrowFunction);
    expect(handler?.node.getText()).toContain('(req, res) =>');
  });

  it('should resolve inline function expression', () => {
    // ARRANGE
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile(
      'test.ts',
      `
      import express from 'express';
      const app = express();
      app.post('/users', function(req, res) {
        res.json({ ok: true });
      });
    `,
    );
    const callExpr = file
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .find((call) => call.getExpression().getText() === 'app.post');
    expect(callExpr).toBeDefined();

    // ACT
    const handler = resolveHandler(callExpr!);

    // ASSERT
    expect(handler).toBeDefined();
    expect(handler?.kind).toBe(SyntaxKind.FunctionExpression);
    expect(handler?.node.getText()).toContain('function(req, res)');
  });

  it('should resolve named function reference', () => {
    // ARRANGE
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile(
      'test.ts',
      `
      import express from 'express';
      const app = express();

      function myHandler(req, res) {
        res.send('Handler');
      }

      app.get('/test', myHandler);
    `,
    );
    const callExpr = file
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .find((call) => call.getExpression().getText() === 'app.get');
    expect(callExpr).toBeDefined();

    // ACT
    const handler = resolveHandler(callExpr!);

    // ASSERT
    expect(handler).toBeDefined();
    expect(handler?.name).toBe('myHandler');
    expect(handler?.node.getText()).toContain('function myHandler');
  });

  it('should take the last handler from multiple arguments', () => {
    // ARRANGE
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile(
      'test.ts',
      `
      import express from 'express';
      const app = express();

      function auth(req, res, next) { next(); }
      function logger(req, res, next) { next(); }
      function handler(req, res) { res.send('OK'); }

      app.get('/protected', auth, logger, handler);
    `,
    );
    const callExpr = file
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .find((call) => call.getExpression().getText() === 'app.get');
    expect(callExpr).toBeDefined();

    // ACT
    const handler = resolveHandler(callExpr!);

    // ASSERT
    expect(handler).toBeDefined();
    expect(handler?.name).toBe('handler');
    expect(handler?.node.getText()).toContain('function handler');
  });

  it('should handle mixed inline and named handlers', () => {
    // ARRANGE
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile(
      'test.ts',
      `
      import express from 'express';
      const app = express();

      function auth(req, res, next) { next(); }

      app.post('/data', auth, (req, res) => {
        res.json({ data: 'value' });
      });
    `,
    );
    const callExpr = file
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .find((call) => call.getExpression().getText() === 'app.post');
    expect(callExpr).toBeDefined();

    // ACT
    const handler = resolveHandler(callExpr!);

    // ASSERT
    expect(handler).toBeDefined();
    expect(handler?.kind).toBe(SyntaxKind.ArrowFunction);
    expect(handler?.node.getText()).toContain('(req, res) =>');
  });

  it('should return null if no handler found', () => {
    // ARRANGE
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile(
      'test.ts',
      `
      import express from 'express';
      const app = express();
      app.get('/');
    `,
    );
    const callExpr = file
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .find((call) => call.getExpression().getText() === 'app.get');
    expect(callExpr).toBeDefined();

    // ACT
    const handler = resolveHandler(callExpr!);

    // ASSERT
    expect(handler).toBeNull();
  });

  describe('Wrapper Pattern Handling', () => {
    it('should unwrap asyncHandler wrapper using default names', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import express, { Request, Response } from 'express';
        const app = express();

        function asyncHandler<T>(fn: T): T { return fn; }

        app.get('/users', asyncHandler((req: Request<{ id: string }>, res: Response) => {
          res.json({ id: req.params.id });
        }));
      `,
      );
      const callExpr = file
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .find((call) => call.getExpression().getText() === 'app.get');
      expect(callExpr).toBeDefined();

      // ACT - use default config (includes asyncHandler)
      const handler = resolveHandler(callExpr!);

      // ASSERT
      expect(handler).toBeDefined();
      expect(handler?.kind).toBe(SyntaxKind.ArrowFunction);
      expect(handler?.node.getText()).toContain('Request<{ id: string }>');
    });

    it('should unwrap wrapper using custom regex pattern', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import express, { Request, Response } from 'express';
        const app = express();

        function myCustomWrapper<T>(fn: T): T { return fn; }

        app.post('/data', myCustomWrapper((req: Request<{}, {}, { name: string }>, res: Response) => {
          res.json({ name: req.body.name });
        }));
      `,
      );
      const callExpr = file
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .find((call) => call.getExpression().getText() === 'app.post');
      expect(callExpr).toBeDefined();

      // ACT - use regex pattern to match
      const handler = resolveHandler(callExpr!, { patterns: [/^my.*Wrapper$/] });

      // ASSERT
      expect(handler).toBeDefined();
      expect(handler?.kind).toBe(SyntaxKind.ArrowFunction);
      expect(handler?.node.getText()).toContain('Request<{}, {}, { name: string }>');
    });

    it('should unwrap nested wrappers', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import express, { Request, Response } from 'express';
        const app = express();

        function asyncHandler<T>(fn: T): T { return fn; }
        function withAuth<T>(fn: T): T { return fn; }

        app.get('/admin', withAuth(asyncHandler((req: Request<{}, { admin: boolean }>, res: Response) => {
          res.json({ admin: true });
        })));
      `,
      );
      const callExpr = file
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .find((call) => call.getExpression().getText() === 'app.get');
      expect(callExpr).toBeDefined();

      // ACT - default config includes both asyncHandler and withAuth
      const handler = resolveHandler(callExpr!);

      // ASSERT
      expect(handler).toBeDefined();
      expect(handler?.kind).toBe(SyntaxKind.ArrowFunction);
      expect(handler?.node.getText()).toContain('{ admin: boolean }');
    });

    it('should not unwrap unknown wrappers without matching config', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import express, { Request, Response } from 'express';
        const app = express();

        function unknownWrapper<T>(fn: T): T { return fn; }

        app.get('/test', unknownWrapper((req: Request<{ id: string }>, res: Response) => {
          res.json({ id: req.params.id });
        }));
      `,
      );
      const callExpr = file
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .find((call) => call.getExpression().getText() === 'app.get');
      expect(callExpr).toBeDefined();

      // ACT - use config without unknownWrapper
      const handler = resolveHandler(callExpr!, { names: ['asyncHandler'] });

      // ASSERT - should return null because unknownWrapper is not recognized
      expect(handler).toBeNull();
    });

    it('should handle wrapper with named function reference', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import express, { Request, Response } from 'express';
        const app = express();

        function asyncHandler<T>(fn: T): T { return fn; }

        function getUserHandler(req: Request<{ id: string }>, res: Response) {
          res.json({ id: req.params.id });
        }

        app.get('/users/:id', asyncHandler(getUserHandler));
      `,
      );
      const callExpr = file
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .find((call) => call.getExpression().getText() === 'app.get');
      expect(callExpr).toBeDefined();

      // ACT
      const handler = resolveHandler(callExpr!);

      // ASSERT
      expect(handler).toBeDefined();
      expect(handler?.name).toBe('getUserHandler');
      expect(handler?.node.getText()).toContain('Request<{ id: string }>');
    });

    it('should match wrapper using multiple regex patterns', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import express, { Request, Response } from 'express';
        const app = express();

        function authMiddleware<T>(fn: T): T { return fn; }

        app.get('/protected', authMiddleware((req: Request<{}, { secure: boolean }>, res: Response) => {
          res.json({ secure: true });
        }));
      `,
      );
      const callExpr = file
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .find((call) => call.getExpression().getText() === 'app.get');
      expect(callExpr).toBeDefined();

      // ACT - use multiple regex patterns
      const handler = resolveHandler(callExpr!, {
        patterns: [/^async.*/, /^auth.*/i, /Middleware$/]
      });

      // ASSERT
      expect(handler).toBeDefined();
      expect(handler?.kind).toBe(SyntaxKind.ArrowFunction);
      expect(handler?.node.getText()).toContain('{ secure: boolean }');
    });
  });
});
