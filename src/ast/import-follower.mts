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
      if (
        namedImport.getName() === identifierText ||
        namedImport?.getAliasNode()?.getText() === identifierText
      ) {
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

  // Try to get the value declaration first
  const valueDecl = defaultExport.getValueDeclaration();
  if (valueDecl) {
    if (Node.isFunctionDeclaration(valueDecl)) {
      return valueDecl;
    }
    if (Node.isVariableDeclaration(valueDecl)) {
      return valueDecl;
    }
  }

  // If valueDecl is null, the export might be an ExportAssignment like "export default userRouter"
  // In this case, we need to get all declarations and find the variable declaration
  const declarations = defaultExport.getDeclarations();
  for (const decl of declarations) {
    // Handle ExportAssignment: export default userRouter
    if (Node.isExportAssignment(decl)) {
      const expression = decl.getExpression();

      if (expression && Node.isIdentifier(expression)) {
        // Follow the identifier to its declaration
        const symbol = expression.getSymbol();
        if (symbol) {
          const targetDecl = symbol.getValueDeclaration();
          if (targetDecl) {
            if (Node.isFunctionDeclaration(targetDecl)) {
              return targetDecl;
            }
            if (Node.isVariableDeclaration(targetDecl)) {
              return targetDecl;
            }
          }
        }
      }
    }
  }

  return null;
}
