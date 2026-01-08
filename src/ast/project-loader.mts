import { Project } from 'ts-morph';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';

export function loadProject(entryPoint: string): Project {
  const absolutePath = resolve(entryPoint);

  if (!existsSync(absolutePath)) {
    throw new Error(`Entry point file not found: ${absolutePath}`);
  }

  const project = new Project({
    skipAddingFilesFromTsConfig: true,
  });

  const tsconfigPath = findTsConfig(dirname(absolutePath));
  if (tsconfigPath) {
    project.addSourceFilesFromTsConfig(tsconfigPath);
  }

  project.addSourceFileAtPath(absolutePath);

  return project;
}

function findTsConfig(dir: string): string | null {
  const tsconfigPath = resolve(dir, 'tsconfig.json');
  if (existsSync(tsconfigPath)) {
    return tsconfigPath;
  }

  const parentDir = dirname(dir);
  if (parentDir === dir) {
    return null;
  }

  return findTsConfig(parentDir);
}
