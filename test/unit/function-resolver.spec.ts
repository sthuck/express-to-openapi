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
});
