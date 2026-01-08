import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Project } from 'ts-morph';
import { loadProject } from '../../src/ast/project-loader.mjs';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

describe('Project Loader', () => {
  const testDir = join(process.cwd(), 'test-temp');

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should load a simple TypeScript file', () => {
    // ARRANGE
    const filePath = join(testDir, 'simple.ts');
    writeFileSync(filePath, 'const x = 42;');

    // ACT
    const project = loadProject(filePath);

    // ASSERT
    expect(project).toBeInstanceOf(Project);
    const sourceFile = project.getSourceFile(filePath);
    expect(sourceFile).toBeDefined();
    expect(sourceFile?.getText()).toContain('const x = 42');
  });

  it('should load a file with imports', () => {
    // ARRANGE
    const mainPath = join(testDir, 'main.ts');
    const helperPath = join(testDir, 'helper.ts');
    writeFileSync(helperPath, 'export const helper = () => {};');
    writeFileSync(mainPath, 'import { helper } from "./helper";');

    // ACT
    const project = loadProject(mainPath);

    // ASSERT
    const mainFile = project.getSourceFile(mainPath);
    expect(mainFile).toBeDefined();
    expect(mainFile?.getText()).toContain('import { helper }');
  });

  it('should handle non-existent files', () => {
    // ARRANGE
    const fakePath = join(testDir, 'does-not-exist.ts');

    // ACT & ASSERT
    expect(() => loadProject(fakePath)).toThrow();
  });

  it('should use tsconfig.json if available', () => {
    // ARRANGE
    const tsconfigPath = join(testDir, 'tsconfig.json');
    const filePath = join(testDir, 'app.ts');
    writeFileSync(
      tsconfigPath,
      JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs',
        },
      }),
    );
    writeFileSync(filePath, 'const y = "hello";');

    // ACT
    const project = loadProject(filePath);

    // ASSERT
    expect(project).toBeInstanceOf(Project);
    const sourceFile = project.getSourceFile(filePath);
    expect(sourceFile).toBeDefined();
  });
});
