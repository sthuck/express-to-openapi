import { describe, it, expect } from 'vitest';
import { Project, SyntaxKind } from 'ts-morph';
import { isExpressApp, isRouter } from '../../src/ast/express-checker.mjs';

describe('Express Checker', () => {
  describe('isExpressApp', () => {
    it('should identify express app', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import express from 'express';
        const app = express();
      `,
      );
      const appVar = file
        .getVariableDeclarations()
        .find((v) => v.getName() === 'app');
      expect(appVar).toBeDefined();

      // ACT
      const result = isExpressApp(appVar!);

      // ASSERT
      expect(result).toBe(true);
    });

    it('should reject non-express objects', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        const fakeApp = { get: () => {} };
      `,
      );
      const fakeVar = file
        .getVariableDeclarations()
        .find((v) => v.getName() === 'fakeApp');
      expect(fakeVar).toBeDefined();

      // ACT
      const result = isExpressApp(fakeVar!);

      // ASSERT
      expect(result).toBe(false);
    });

    it('should reject unrelated variables', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import express from 'express';
        const app = express();
        const x = 42;
      `,
      );
      const xVar = file
        .getVariableDeclarations()
        .find((v) => v.getName() === 'x');
      expect(xVar).toBeDefined();

      // ACT
      const result = isExpressApp(xVar!);

      // ASSERT
      expect(result).toBe(false);
    });
  });

  describe('isRouter', () => {
    it('should identify Router() call', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Router } from 'express';
        const router = Router();
      `,
      );
      const routerVar = file
        .getVariableDeclarations()
        .find((v) => v.getName() === 'router');
      expect(routerVar).toBeDefined();

      // ACT
      const result = isRouter(routerVar!);

      // ASSERT
      expect(result).toBe(true);
    });

    it('should identify express.Router() call', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import express from 'express';
        const router = express.Router();
      `,
      );
      const routerVar = file
        .getVariableDeclarations()
        .find((v) => v.getName() === 'router');
      expect(routerVar).toBeDefined();

      // ACT
      const result = isRouter(routerVar!);

      // ASSERT
      expect(result).toBe(true);
    });

    it('should reject non-router objects', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        const fakeRouter = { get: () => {} };
      `,
      );
      const fakeVar = file
        .getVariableDeclarations()
        .find((v) => v.getName() === 'fakeRouter');
      expect(fakeVar).toBeDefined();

      // ACT
      const result = isRouter(fakeVar!);

      // ASSERT
      expect(result).toBe(false);
    });
  });
});
