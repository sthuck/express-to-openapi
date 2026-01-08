import { describe, it, expect } from 'vitest';
import { Project, SyntaxKind } from 'ts-morph';
import { followImport } from '../../src/ast/import-follower.mjs';

describe('Import Follower', () => {
  it('should follow named import', () => {
    // ARRANGE
    const project = new Project({ useInMemoryFileSystem: true });
    const handlerFile = project.createSourceFile(
      'handlers.ts',
      `
      export function getUsers(req, res) {
        res.json({ users: [] });
      }
    `,
    );
    const mainFile = project.createSourceFile(
      'main.ts',
      `
      import { getUsers } from './handlers';
      import express from 'express';
      const app = express();
      app.get('/users', getUsers);
    `,
    );
    const callExpr = mainFile
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .find((call) => call.getExpression().getText() === 'app.get');
    const identifier = callExpr
      ?.getArguments()[1]
      .asKind(SyntaxKind.Identifier);
    expect(identifier).toBeDefined();

    // ACT
    const resolved = followImport(identifier!);

    // ASSERT
    expect(resolved).toBeDefined();
    expect(resolved?.getName()).toBe('getUsers');
    expect(resolved?.getText()).toContain('function getUsers');
  });

  it('should follow default import', () => {
    // ARRANGE
    const project = new Project({ useInMemoryFileSystem: true });
    const _handlerFile = project.createSourceFile(
      'handler.ts',
      `
      export default function createUser(req, res) {
        res.json({ created: true });
      }
    `,
    );
    const mainFile = project.createSourceFile(
      'main.ts',
      `
      import createUser from './handler';
      import express from 'express';
      const app = express();
      app.post('/users', createUser);
    `,
    );
    const callExpr = mainFile
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .find((call) => call.getExpression().getText() === 'app.post');
    const identifier = callExpr
      ?.getArguments()[1]
      .asKind(SyntaxKind.Identifier);
    expect(identifier).toBeDefined();

    // ACT
    const resolved = followImport(identifier!);

    // ASSERT
    expect(resolved).toBeDefined();
    expect(resolved?.getText()).toContain('function createUser');
  });

  it('should handle relative paths', () => {
    // ARRANGE
    const project = new Project({ useInMemoryFileSystem: true });
    const handlerFile = project.createSourceFile(
      'src/handlers/user.ts',
      `
      export const deleteUser = (req, res) => {
        res.json({ deleted: true });
      };
    `,
    );
    const mainFile = project.createSourceFile(
      'src/routes/users.ts',
      `
      import { deleteUser } from '../handlers/user';
      import express from 'express';
      const router = express.Router();
      router.delete('/:id', deleteUser);
    `,
    );
    const callExpr = mainFile
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .find((call) => call.getExpression().getText() === 'router.delete');
    const identifier = callExpr
      ?.getArguments()[1]
      .asKind(SyntaxKind.Identifier);
    expect(identifier).toBeDefined();

    // ACT
    const resolved = followImport(identifier!);

    // ASSERT
    expect(resolved).toBeDefined();
    expect(resolved?.getText()).toContain('deleteUser');
  });

  it('should return null for non-imported identifiers', () => {
    // ARRANGE
    const project = new Project({ useInMemoryFileSystem: true });
    const mainFile = project.createSourceFile(
      'main.ts',
      `
      import express from 'express';
      const app = express();

      function localHandler(req, res) {
        res.send('OK');
      }

      app.get('/test', localHandler);
    `,
    );
    const callExpr = mainFile
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .find((call) => call.getExpression().getText() === 'app.get');
    const identifier = callExpr
      ?.getArguments()[1]
      .asKind(SyntaxKind.Identifier);
    expect(identifier).toBeDefined();

    // ACT
    const resolved = followImport(identifier!);

    // ASSERT
    expect(resolved).toBeNull();
  });

  it('should handle re-exported imports', () => {
    // ARRANGE
    const project = new Project({ useInMemoryFileSystem: true });
    const baseFile = project.createSourceFile(
      'handlers/base.ts',
      `
      export function baseHandler(req, res) {
        res.send('base');
      }
    `,
    );
    const indexFile = project.createSourceFile(
      'handlers/index.ts',
      `
      export { baseHandler } from './base';
    `,
    );
    const mainFile = project.createSourceFile(
      'main.ts',
      `
      import { baseHandler } from './handlers';
      import express from 'express';
      const app = express();
      app.get('/base', baseHandler);
    `,
    );
    const callExpr = mainFile
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .find((call) => call.getExpression().getText() === 'app.get');
    const identifier = callExpr
      ?.getArguments()[1]
      .asKind(SyntaxKind.Identifier);
    expect(identifier).toBeDefined();

    // ACT
    const resolved = followImport(identifier!);

    // ASSERT
    expect(resolved).toBeDefined();
    expect(resolved?.getText()).toContain('function baseHandler');
  });
});
