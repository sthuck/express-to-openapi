import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { parseJsDoc } from '../../src/core/jsdoc-parser.mjs';

describe('JSDoc Parser', () => {
  it('should extract basic description', () => {
    // ARRANGE
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile(
      'test.ts',
      `
      /**
       * Get all users from the database
       */
      function getUsers(req, res) {}
    `,
    );
    const func = file.getFunctions()[0];

    // ACT
    const result = parseJsDoc(func);

    // ASSERT
    expect(result).toBeDefined();
    expect(result?.description).toBe('Get all users from the database');
  });

  it('should extract @summary tag', () => {
    // ARRANGE
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile(
      'test.ts',
      `
      /**
       * @summary Retrieves a user
       */
      function getUser(req, res) {}
    `,
    );
    const func = file.getFunctions()[0];

    // ACT
    const result = parseJsDoc(func);

    // ASSERT
    expect(result).toBeDefined();
    expect(result?.summary).toBe('Retrieves a user');
  });

  it('should extract both summary and description', () => {
    // ARRANGE
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile(
      'test.ts',
      `
      /**
       * Get user by ID
       * @summary Retrieves a user
       * @param {string} id - User ID
       */
      function getUser(req, res) {}
    `,
    );
    const func = file.getFunctions()[0];

    // ACT
    const result = parseJsDoc(func);

    // ASSERT
    expect(result).toBeDefined();
    expect(result?.description).toBe('Get user by ID');
    expect(result?.summary).toBe('Retrieves a user');
  });

  it('should extract @description tag explicitly', () => {
    // ARRANGE
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile(
      'test.ts',
      `
      /**
       * @description Creates a new user in the system
       * @summary Create user
       */
      function createUser(req, res) {}
    `,
    );
    const func = file.getFunctions()[0];

    // ACT
    const result = parseJsDoc(func);

    // ASSERT
    expect(result).toBeDefined();
    expect(result?.description).toBe('Creates a new user in the system');
    expect(result?.summary).toBe('Create user');
  });

  it('should extract custom tags', () => {
    // ARRANGE
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile(
      'test.ts',
      `
      /**
       * Delete a user
       * @param {string} id - User ID
       * @returns {Object} Deletion result
       * @deprecated Use deleteUserV2 instead
       */
      function deleteUser(req, res) {}
    `,
    );
    const func = file.getFunctions()[0];

    // ACT
    const result = parseJsDoc(func);

    // ASSERT
    expect(result).toBeDefined();
    expect(result?.tags).toBeDefined();
    expect(result?.tags.get('deprecated')).toBe('Use deleteUserV2 instead');
  });

  it('should handle multiple lines in description', () => {
    // ARRANGE
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile(
      'test.ts',
      `
      /**
       * This is a multi-line description
       * that spans multiple lines
       * and should be concatenated
       */
      function handler(req, res) {}
    `,
    );
    const func = file.getFunctions()[0];

    // ACT
    const result = parseJsDoc(func);

    // ASSERT
    expect(result).toBeDefined();
    expect(result?.description).toContain('multi-line description');
    expect(result?.description).toContain('spans multiple lines');
    expect(result?.description).toContain('should be concatenated');
  });

  it('should return null for functions without JSDoc', () => {
    // ARRANGE
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile(
      'test.ts',
      `
      function noDocsHandler(req, res) {}
    `,
    );
    const func = file.getFunctions()[0];

    // ACT
    const result = parseJsDoc(func);

    // ASSERT
    expect(result).toBeNull();
  });

  it('should handle arrow functions with JSDoc', () => {
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
    const arrowFunc = varDecl.getInitializer();

    // ACT
    const result = parseJsDoc(arrowFunc!);

    // ASSERT
    expect(result).toBeDefined();
    expect(result?.description).toBe('Arrow function handler');
    expect(result?.summary).toBe('Handle request');
  });

  it('should handle empty JSDoc comment', () => {
    // ARRANGE
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile(
      'test.ts',
      `
      /**
       */
      function emptyDoc(req, res) {}
    `,
    );
    const func = file.getFunctions()[0];

    // ACT
    const result = parseJsDoc(func);

    // ASSERT
    expect(result).toBeNull();
  });

  it('should extract multiple custom tags', () => {
    // ARRANGE
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile(
      'test.ts',
      `
      /**
       * Update user information
       * @summary Update user
       * @param {string} id - User ID
       * @param {Object} data - User data
       * @returns {Object} Updated user
       * @throws {Error} If user not found
       */
      function updateUser(req, res) {}
    `,
    );
    const func = file.getFunctions()[0];

    // ACT
    const result = parseJsDoc(func);

    // ASSERT
    expect(result).toBeDefined();
    expect(result?.description).toBe('Update user information');
    expect(result?.summary).toBe('Update user');
    expect(result?.tags.size).toBeGreaterThan(0);
  });
});
