import { describe, it, expect, vi } from 'vitest';
import { Project } from 'ts-morph';
import { extractRequestTypes, expandTypeToStructure } from '../../src/core/type-extraction.mjs';

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

  describe('Complex Types', () => {
    it('should extract union types', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Request, Response } from 'express';

        function getItem(req: Request<{ id: string | number }>, res: Response) {
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
      expect(result?.pathParams?.typeText).toMatch(/string.*\|.*number|number.*\|.*string/);
    });

    it('should extract mapped types (Record)', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Request, Response } from 'express';

        interface User {
          name: string;
        }

        function getUsers(req: Request<{}, Record<string, User>>, res: Response) {
          res.json({});
        }
      `,
      );
      const func = file.getFunctions()[0];

      // ACT
      const result = extractRequestTypes(func);

      // ASSERT
      expect(result).toBeDefined();
      expect(result?.responseBody).toBeDefined();
      expect(result?.responseBody?.isNamed).toBe(false);
      expect(result?.responseBody?.resolvedTypeText).toBeDefined();
    });

    it('should extract utility types (Partial)', () => {
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

        function updateUser(req: Request<{}, {}, Partial<User>>, res: Response) {
          res.json({ updated: true });
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
      expect(result?.bodyParams?.resolvedTypeText).toBeDefined();
      expect(result?.bodyParams?.resolvedTypeText).toContain('name');
      expect(result?.bodyParams?.resolvedTypeText).toContain('email');
    });

    it('should extract intersection types', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Request, Response } from 'express';

        interface BaseUser {
          id: string;
        }

        interface AdminPermissions {
          role: string;
        }

        function getAdmin(req: Request<BaseUser & AdminPermissions>, res: Response) {
          res.json({});
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
      expect(result?.pathParams?.resolvedTypeText).toBeDefined();
      expect(result?.pathParams?.resolvedTypeText).toContain('id');
      expect(result?.pathParams?.resolvedTypeText).toContain('role');
    });

    it('should extract Pick utility type', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Request, Response } from 'express';

        interface User {
          id: string;
          name: string;
          password: string;
        }

        function getUser(req: Request<{}, Pick<User, 'id' | 'name'>>, res: Response) {
          res.json({});
        }
      `,
      );
      const func = file.getFunctions()[0];

      // ACT
      const result = extractRequestTypes(func);

      // ASSERT
      expect(result).toBeDefined();
      expect(result?.responseBody).toBeDefined();
      expect(result?.responseBody?.isNamed).toBe(false);
      expect(result?.responseBody?.resolvedTypeText).toContain('id');
      expect(result?.responseBody?.resolvedTypeText).toContain('name');
      expect(result?.responseBody?.resolvedTypeText).not.toContain('password');
    });

    it('should extract Omit utility type', () => {
      // ARRANGE
      const project = new Project({ useInMemoryFileSystem: true });
      const file = project.createSourceFile(
        'test.ts',
        `
        import { Request, Response } from 'express';

        interface User {
          id: string;
          name: string;
          password: string;
        }

        function getUser(req: Request<{}, Omit<User, 'password'>>, res: Response) {
          res.json({});
        }
      `,
      );
      const func = file.getFunctions()[0];

      // ACT
      const result = extractRequestTypes(func);

      // ASSERT
      expect(result).toBeDefined();
      expect(result?.responseBody).toBeDefined();
      expect(result?.responseBody?.isNamed).toBe(false);
      expect(result?.responseBody?.resolvedTypeText).toContain('id');
      expect(result?.responseBody?.resolvedTypeText).toContain('name');
      expect(result?.responseBody?.resolvedTypeText).not.toContain('password');
    });
  });
});

describe('expandTypeToStructure', () => {
  it('should expand a simple interface to structural form', () => {
    // ARRANGE
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile(
      'test.ts',
      `
      interface User {
        name: string;
        age: number;
      }
      const x: User = { name: '', age: 0 };
    `,
    );
    const varDecl = file.getVariableDeclarations()[0];
    const typeNode = varDecl.getTypeNode()!;
    const type = typeNode.getType();

    // ACT
    const result = expandTypeToStructure(type, typeNode);

    // ASSERT
    expect(result).toContain('name');
    expect(result).toContain('string');
    expect(result).toContain('age');
    expect(result).toContain('number');
  });

  it('should expand Partial utility type with optional markers', () => {
    // ARRANGE
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile(
      'test.ts',
      `
      interface User {
        name: string;
        age: number;
      }
      const x: Partial<User> = {};
    `,
    );
    const varDecl = file.getVariableDeclarations()[0];
    const typeNode = varDecl.getTypeNode()!;
    const type = typeNode.getType();

    // ACT
    const result = expandTypeToStructure(type, typeNode);

    // ASSERT
    expect(result).toContain('name?');
    expect(result).toContain('age?');
  });

  it('should expand intersection types to merged structure', () => {
    // ARRANGE
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile(
      'test.ts',
      `
      interface Base {
        id: string;
      }
      interface Extra {
        role: string;
      }
      const x: Base & Extra = { id: '', role: '' };
    `,
    );
    const varDecl = file.getVariableDeclarations()[0];
    const typeNode = varDecl.getTypeNode()!;
    const type = typeNode.getType();

    // ACT
    const result = expandTypeToStructure(type, typeNode);

    // ASSERT
    expect(result).toContain('id');
    expect(result).toContain('role');
  });

  it('should expand Pick utility type with selected properties only', () => {
    // ARRANGE
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile(
      'test.ts',
      `
      interface User {
        id: string;
        name: string;
        password: string;
      }
      const x: Pick<User, 'id' | 'name'> = { id: '', name: '' };
    `,
    );
    const varDecl = file.getVariableDeclarations()[0];
    const typeNode = varDecl.getTypeNode()!;
    const type = typeNode.getType();

    // ACT
    const result = expandTypeToStructure(type, typeNode);

    // ASSERT
    expect(result).toContain('id');
    expect(result).toContain('name');
    expect(result).not.toContain('password');
  });

  it('should expand Omit utility type excluding specified properties', () => {
    // ARRANGE
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile(
      'test.ts',
      `
      interface User {
        id: string;
        name: string;
        password: string;
      }
      const x: Omit<User, 'password'> = { id: '', name: '' };
    `,
    );
    const varDecl = file.getVariableDeclarations()[0];
    const typeNode = varDecl.getTypeNode()!;
    const type = typeNode.getType();

    // ACT
    const result = expandTypeToStructure(type, typeNode);

    // ASSERT
    expect(result).toContain('id');
    expect(result).toContain('name');
    expect(result).not.toContain('password');
  });

  it('should expand Record utility type', () => {
    // ARRANGE
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile(
      'test.ts',
      `
      const x: Record<string, number> = {};
    `,
    );
    const varDecl = file.getVariableDeclarations()[0];
    const typeNode = varDecl.getTypeNode()!;
    const type = typeNode.getType();

    // ACT
    const result = expandTypeToStructure(type, typeNode);

    // ASSERT
    // Record<string, number> has no fixed properties, should return type text
    expect(result).toBeDefined();
  });

  it('should return type text for empty object type', () => {
    // ARRANGE
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile(
      'test.ts',
      `
      const x: {} = {};
    `,
    );
    const varDecl = file.getVariableDeclarations()[0];
    const typeNode = varDecl.getTypeNode()!;
    const type = typeNode.getType();

    // ACT
    const result = expandTypeToStructure(type, typeNode);

    // ASSERT
    // Empty object type has no properties, returns getText()
    expect(result).toBe('{}');
  });

  it('should handle nested object types', () => {
    // ARRANGE
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile(
      'test.ts',
      `
      interface Address {
        street: string;
        city: string;
      }
      interface User {
        name: string;
        address: Address;
      }
      const x: User = { name: '', address: { street: '', city: '' } };
    `,
    );
    const varDecl = file.getVariableDeclarations()[0];
    const typeNode = varDecl.getTypeNode()!;
    const type = typeNode.getType();

    // ACT
    const result = expandTypeToStructure(type, typeNode);

    // ASSERT
    expect(result).toContain('name');
    expect(result).toContain('address');
    expect(result).toContain('Address');
  });
});

describe('Response Type Extraction', () => {
  it('should extract response type from Response<Type> parameter', () => {
    // ARRANGE
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile(
      'test.ts',
      `
      import { Request, Response } from 'express';

      interface UserResponse {
        id: string;
        name: string;
      }

      function getUser(req: Request, res: Response<UserResponse>) {
        res.json({ id: '1', name: 'John' });
      }
    `,
    );
    const func = file.getFunctions()[0];

    // ACT
    const result = extractRequestTypes(func);

    // ASSERT
    expect(result).toBeDefined();
    expect(result?.responseBody).toBeDefined();
    expect(result?.responseBody?.isNamed).toBe(true);
    expect(result?.responseBody?.typeName).toBe('UserResponse');
  });

  it('should extract inline response type from Response', () => {
    // ARRANGE
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile(
      'test.ts',
      `
      import { Request, Response } from 'express';

      function getUser(req: Request, res: Response<{ id: string; name: string }>) {
        res.json({ id: '1', name: 'John' });
      }
    `,
    );
    const func = file.getFunctions()[0];

    // ACT
    const result = extractRequestTypes(func);

    // ASSERT
    expect(result).toBeDefined();
    expect(result?.responseBody).toBeDefined();
    expect(result?.responseBody?.isNamed).toBe(false);
    expect(result?.responseBody?.typeText).toContain('id');
    expect(result?.responseBody?.typeText).toContain('name');
  });

  it('should prefer Response type when both Request and Response define same response type', () => {
    // ARRANGE
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile(
      'test.ts',
      `
      import { Request, Response } from 'express';

      interface UserResponse {
        id: string;
        name: string;
      }

      function getUser(req: Request<{}, UserResponse>, res: Response<UserResponse>) {
        res.json({ id: '1', name: 'John' });
      }
    `,
    );
    const func = file.getFunctions()[0];

    // ACT
    const result = extractRequestTypes(func);

    // ASSERT - should use the same type (no warning)
    expect(result).toBeDefined();
    expect(result?.responseBody).toBeDefined();
    expect(result?.responseBody?.isNamed).toBe(true);
    expect(result?.responseBody?.typeName).toBe('UserResponse');
  });

  it('should use Response type and warn when Request and Response have different types', () => {
    // ARRANGE
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile(
      'test.ts',
      `
      import { Request, Response } from 'express';

      interface RequestResponse {
        fromRequest: boolean;
      }

      interface ActualResponse {
        fromResponse: boolean;
      }

      function getUser(req: Request<{}, RequestResponse>, res: Response<ActualResponse>) {
        res.json({ fromResponse: true });
      }
    `,
    );
    const func = file.getFunctions()[0];
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // ACT
    const result = extractRequestTypes(func);

    // ASSERT - should use Response type and warn
    expect(result).toBeDefined();
    expect(result?.responseBody).toBeDefined();
    expect(result?.responseBody?.isNamed).toBe(true);
    expect(result?.responseBody?.typeName).toBe('ActualResponse');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Response type mismatch')
    );

    warnSpy.mockRestore();
  });

  it('should use Request response type when Response has no type parameter', () => {
    // ARRANGE
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile(
      'test.ts',
      `
      import { Request, Response } from 'express';

      interface UserResponse {
        id: string;
        name: string;
      }

      function getUser(req: Request<{}, UserResponse>, res: Response) {
        res.json({ id: '1', name: 'John' });
      }
    `,
    );
    const func = file.getFunctions()[0];

    // ACT
    const result = extractRequestTypes(func);

    // ASSERT - should use Request's response type
    expect(result).toBeDefined();
    expect(result?.responseBody).toBeDefined();
    expect(result?.responseBody?.isNamed).toBe(true);
    expect(result?.responseBody?.typeName).toBe('UserResponse');
  });

  it('should handle arrow function with Response type', () => {
    // ARRANGE
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile(
      'test.ts',
      `
      import { Request, Response } from 'express';

      interface UserResponse {
        id: string;
        name: string;
      }

      const getUser = (req: Request, res: Response<UserResponse>) => {
        res.json({ id: '1', name: 'John' });
      };
    `,
    );
    const varDecl = file.getVariableDeclarations()[0];
    const arrowFunc = varDecl.getInitializer();
    expect(arrowFunc).toBeDefined();

    // ACT
    const result = extractRequestTypes(arrowFunc!);

    // ASSERT
    expect(result).toBeDefined();
    expect(result?.responseBody).toBeDefined();
    expect(result?.responseBody?.isNamed).toBe(true);
    expect(result?.responseBody?.typeName).toBe('UserResponse');
  });
});
