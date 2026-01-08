import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { extractRequestTypes } from '../../src/core/type-extraction.mjs';

describe('Type Extraction', () => {
  describe('Path Parameters', () => {
    it('should extract inline path parameter types', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Request, Response } from 'express';

        function getUser(req: Request<{ id: string }>, res: Response) {
          res.json({ id: req.params.id });
        }
      `,
      );
      const func = file.getFunctions()[0];

      // ACT
      const result = extractRequestTypes(func);

      // ASSERT
      expect(result).toBeDefined();
      expect(result?.pathParams).toBeDefined();
      expect(result?.pathParams?.isNamed).toBe(false);
      expect(result?.pathParams?.typeText).toContain('id');
      expect(result?.pathParams?.typeText).toContain('string');
    });

    it('should extract named path parameter types', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Request, Response } from 'express';

        interface UserParams {
          id: string;
        }

        function getUser(req: Request<UserParams>, res: Response) {
          res.json({ id: req.params.id });
        }
      `,
      );
      const func = file.getFunctions()[0];

      // ACT
      const result = extractRequestTypes(func);

      // ASSERT
      expect(result).toBeDefined();
      expect(result?.pathParams).toBeDefined();
      expect(result?.pathParams?.isNamed).toBe(true);
      expect(result?.pathParams?.typeName).toBe('UserParams');
    });
  });

  describe('Query Parameters', () => {
    it('should extract inline query parameter types', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Request, Response } from 'express';

        function getUsers(
          req: Request<{}, {}, {}, { page: number; limit: number }>,
          res: Response
        ) {
          res.json({ page: req.query.page });
        }
      `,
      );
      const func = file.getFunctions()[0];

      // ACT
      const result = extractRequestTypes(func);

      // ASSERT
      expect(result).toBeDefined();
      expect(result?.queryParams).toBeDefined();
      expect(result?.queryParams?.isNamed).toBe(false);
      expect(result?.queryParams?.typeText).toContain('page');
      expect(result?.queryParams?.typeText).toContain('limit');
    });

    it('should extract named query parameter types', () => {
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
        ) {
          res.json({ page: req.query.page });
        }
      `,
      );
      const func = file.getFunctions()[0];

      // ACT
      const result = extractRequestTypes(func);

      // ASSERT
      expect(result).toBeDefined();
      expect(result?.queryParams).toBeDefined();
      expect(result?.queryParams?.isNamed).toBe(true);
      expect(result?.queryParams?.typeName).toBe('PaginationQuery');
    });
  });

  describe('Body Parameters', () => {
    it('should extract inline body parameter types', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Request, Response } from 'express';

        function createUser(
          req: Request<{}, {}, { name: string; email: string }>,
          res: Response
        ) {
          res.json({ name: req.body.name });
        }
      `,
      );
      const func = file.getFunctions()[0];

      // ACT
      const result = extractRequestTypes(func);

      // ASSERT
      expect(result).toBeDefined();
      expect(result?.bodyParams).toBeDefined();
      expect(result?.bodyParams?.isNamed).toBe(false);
      expect(result?.bodyParams?.typeText).toContain('name');
      expect(result?.bodyParams?.typeText).toContain('email');
    });

    it('should extract named body parameter types', () => {
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

        function createUser(
          req: Request<{}, {}, CreateUserBody>,
          res: Response
        ) {
          res.json({ name: req.body.name });
        }
      `,
      );
      const func = file.getFunctions()[0];

      // ACT
      const result = extractRequestTypes(func);

      // ASSERT
      expect(result).toBeDefined();
      expect(result?.bodyParams).toBeDefined();
      expect(result?.bodyParams?.isNamed).toBe(true);
      expect(result?.bodyParams?.typeName).toBe('CreateUserBody');
    });
  });

  describe('Arrow Functions', () => {
    it('should extract types from arrow functions', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Request, Response } from 'express';

        const getUser = (req: Request<{ id: string }>, res: Response) => {
          res.json({ id: req.params.id });
        };
      `,
      );
      const varDecl = file.getVariableDeclarations()[0];
      const arrowFunc = varDecl.getInitializer()!;

      // ACT
      const result = extractRequestTypes(arrowFunc);

      // ASSERT
      expect(result).toBeDefined();
      expect(result?.pathParams).toBeDefined();
      expect(result?.pathParams?.isNamed).toBe(false);
    });
  });

  describe('Combined Parameters', () => {
    it('should extract all parameter types together', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Request, Response } from 'express';

        interface UpdateUserBody {
          name: string;
        }

        function updateUser(
          req: Request<{ id: string }, {}, UpdateUserBody, { notify: boolean }>,
          res: Response
        ) {
          res.json({ updated: true });
        }
      `,
      );
      const func = file.getFunctions()[0];

      // ACT
      const result = extractRequestTypes(func);

      // ASSERT
      expect(result).toBeDefined();
      expect(result?.pathParams).toBeDefined();
      expect(result?.pathParams?.isNamed).toBe(false);
      expect(result?.bodyParams).toBeDefined();
      expect(result?.bodyParams?.isNamed).toBe(true);
      expect(result?.bodyParams?.typeName).toBe('UpdateUserBody');
      expect(result?.queryParams).toBeDefined();
      expect(result?.queryParams?.isNamed).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should return null for functions without Request type', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        function handler(req, res) {
          res.json({ ok: true });
        }
      `,
      );
      const func = file.getFunctions()[0];

      // ACT
      const result = extractRequestTypes(func);

      // ASSERT
      expect(result).toBeNull();
    });

    it('should return null for functions without req parameter', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Response } from 'express';

        function handler(res: Response) {
          res.json({ ok: true });
        }
      `,
      );
      const func = file.getFunctions()[0];

      // ACT
      const result = extractRequestTypes(func);

      // ASSERT
      expect(result).toBeNull();
    });

    it('should handle Request without generics', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Request, Response } from 'express';

        function handler(req: Request, res: Response) {
          res.json({ ok: true });
        }
      `,
      );
      const func = file.getFunctions()[0];

      // ACT
      const result = extractRequestTypes(func);

      // ASSERT
      expect(result).toBeDefined();
      expect(result?.pathParams).toBeUndefined();
      expect(result?.bodyParams).toBeUndefined();
      expect(result?.queryParams).toBeUndefined();
    });

    it('should handle empty object generics', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Request, Response } from 'express';

        function handler(req: Request<{}>, res: Response) {
          res.json({ ok: true });
        }
      `,
      );
      const func = file.getFunctions()[0];

      // ACT
      const result = extractRequestTypes(func);

      // ASSERT
      expect(result).toBeDefined();
      expect(result?.pathParams).toBeUndefined();
    });
  });
});
