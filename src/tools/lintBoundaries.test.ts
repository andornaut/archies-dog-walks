import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import { expect, it } from "vitest";

const lint = new ESLint({ cwd: fileURLToPath(new URL("../../", import.meta.url)) });

it.each([
  ["ui/dom/probe.ts", "@andornaut/game-kit/runtime/input/modalInput", false],
  ["ui/dom/probe.ts", "@andornaut/game-kit/runtime/input/onePress", false],
  ["ui/dom/probe.ts", "../../input/onePress.ts", true],
  ["ui/dom/probe.ts", "../../scenes/uiKit.ts", true],
  ["road/probe.ts", "../rules/route.ts", false],
  ["road/probe.ts", "../rules/run.ts", true],
])("enforces source ownership for %s importing %s", async (file, path, forbidden) => {
  const results = await lint.lintText(`import { value } from "${path}"; void value;`, {
    filePath: `src/${file}`,
  });
  const violations = results.flatMap(({ messages }) =>
    messages.filter(({ ruleId }) => ruleId === "no-restricted-imports"),
  );
  expect(violations.length > 0).toBe(forbidden);
});
