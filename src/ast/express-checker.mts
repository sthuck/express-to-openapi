import { VariableDeclaration, Node } from "ts-morph";

export function isExpressApp(variable: VariableDeclaration): boolean {
  const initializer = variable.getInitializer();
  if (!initializer) {
    return false;
  }

  if (Node.isCallExpression(initializer)) {
    const expression = initializer.getExpression();
    const expressionText = expression.getText();

    return expressionText === "express" || expressionText === "express()";
  }

  return false;
}

export function isRouter(variable: VariableDeclaration): boolean {
  const initializer = variable.getInitializer();
  if (!initializer) {
    return false;
  }

  if (Node.isCallExpression(initializer)) {
    const expression = initializer.getExpression();
    const expressionText = expression.getText();

    return (
      expressionText === "Router" ||
      expressionText === "express.Router" ||
      expressionText === "Router()" ||
      expressionText === "express.Router()"
    );
  }

  return false;
}
