import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";
import { expect, it } from "vitest";

// Discrete game actions cannot acquire an independent click path outside the shared binding.
it("routes game click handlers through the action binding while preserving capture-only admission", () => {
  const bypasses: string[] = [];
  const captures: string[] = [];
  const files = readdirSync("src", { recursive: true, withFileTypes: true })
    .filter(
      (entry) => entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts"),
    )
    .map((entry) => join(entry.parentPath, entry.name).replaceAll("\\", "/"));
  for (const path of files) {
    const file = ts.createSourceFile(
      path,
      readFileSync(path, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "addEventListener" &&
        node.arguments[0] !== undefined &&
        ts.isStringLiteral(node.arguments[0]) &&
        node.arguments[0].text === "click"
      ) {
        if (path === "src/ui/dom/actionBinding.ts") {
          // The binding owns the one native action listener.
        } else if (
          path === "src/ui/dom/modalLifecycle.ts" &&
          node.arguments[2]?.kind === ts.SyntaxKind.TrueKeyword
        ) {
          captures.push(path);
        } else {
          bypasses.push(`${path}:${file.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
        }
      }
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        node.moduleSpecifier.text.endsWith("/holdActions") &&
        path !== "src/ui/dom/actionBinding.ts"
      ) {
        bypasses.push(`${path}:independent hold dispatcher`);
      }
      if (
        ts.isBinaryExpression(node) &&
        ts.isPropertyAccessExpression(node.left) &&
        node.left.name.text === "onclick"
      ) {
        bypasses.push(`${path}:onclick`);
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  expect(bypasses).toEqual([]);
  expect(captures).toEqual(["src/ui/dom/modalLifecycle.ts"]);
});
