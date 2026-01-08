import {
  Identifier,
  Node,
  FunctionDeclaration,
  VariableDeclaration,
} from 'ts-morph';

export function followImport(
  identifier: Identifier,
): FunctionDeclaration | VariableDeclaration | null {
  const sourceFile = identifier.getSourceFile();
  const identifierText = identifier.getText();

  const importDecls = sourceFile.getImportDeclarations();

  for (const importDecl of importDecls) {
    const defaultImport = importDecl.getDefaultImport();
    if (defaultImport?.getText() === identifierText) {
      return followDefaultImport(importDecl);
    }

    const namedImports = importDecl.getNamedImports();
    for (const namedImport of namedImports) {
      if (namedImport.getName() === identifierText) {
        return followNamedImport(namedImport);
      }
    }
  }

  return null;
}

function followNamedImport(
  importSpecifier: Node,
): FunctionDeclaration | VariableDeclaration | null {
  if (!Node.isImportSpecifier(importSpecifier)) {
    return null;
  }

  const importDecl = importSpecifier.getImportDeclaration();
  const moduleSpecifier = importDecl.getModuleSpecifierSourceFile();

  if (!moduleSpecifier) {
    return null;
  }

  const exportedName = importSpecifier.getName();
  const exportedDecls = moduleSpecifier.getExportedDeclarations();

  for (const [name, decls] of exportedDecls) {
    if (name === exportedName) {
      for (const decl of decls) {
        if (Node.isFunctionDeclaration(decl)) {
          return decl;
        }
        if (Node.isVariableDeclaration(decl)) {
          return decl;
        }
        if (Node.isExportSpecifier(decl)) {
          const localSymbol = decl.getLocalTargetDeclarations()[0];
          if (
            localSymbol &&
            (Node.isFunctionDeclaration(localSymbol) ||
              Node.isVariableDeclaration(localSymbol))
          ) {
            return localSymbol as FunctionDeclaration | VariableDeclaration;
          }
        }
      }
    }
  }

  return null;
}

function followDefaultImport(
  importDecl: Node,
): FunctionDeclaration | VariableDeclaration | null {
  if (!Node.isImportDeclaration(importDecl)) {
    return null;
  }

  const moduleSpecifier = importDecl.getModuleSpecifierSourceFile();
  if (!moduleSpecifier) {
    return null;
  }

  const defaultExport = moduleSpecifier.getDefaultExportSymbol();
  if (!defaultExport) {
    return null;
  }

  const valueDecl = defaultExport.getValueDeclaration();
  if (valueDecl) {
    if (Node.isFunctionDeclaration(valueDecl)) {
      return valueDecl;
    }
    if (Node.isVariableDeclaration(valueDecl)) {
      return valueDecl;
    }
  }

  return null;
}
