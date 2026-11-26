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

it.each([
  ["save/probe.ts", 'import "../rules/causes.ts";', undefined],
  ["tools/probe.ts", 'import "./atlas/atlasLayout.ts";', undefined],
  ["rules/probe.test.ts", 'import "../save/settings.ts";', undefined],
  ["rules/probe.ts", 'type T = typeof import("@andornaut/game-kit/runtime/rect");', undefined],
  ["rules/probe.ts", 'import "../save/settings.ts";', "import-x/no-restricted-paths"],
  [
    "rules/probe.ts",
    'import type { S } from "../save/settings.ts";',
    "import-x/no-restricted-paths",
  ],
  ["audio/probe.ts", 'import "../presentation/currency.ts";', "import-x/no-restricted-paths"],
  ["units.ts", 'import "./packCapacity.ts";', "import-x/no-restricted-paths"],
  ["main.ts", 'import "./startup.ts";', "import-x/no-restricted-paths"],
  ["ui/probe.ts", 'import "./dom/actionBinding.ts";', "import-x/no-restricted-paths"],
  ["tools/atlas/probe.ts", 'import "../files.ts";', "import-x/no-restricted-paths"],
  ["pwa/probe.ts", 'import "../tools/files.ts";', "import-x/no-restricted-paths"],
  ["rules/probe.ts", 'type T = typeof import("../state/runState.ts");', "no-restricted-syntax"],
  ["probeArea/probe.ts", "export const value = 1;", "no-restricted-syntax"],
])("holds src/%s with %s to the bands", async (file, text, rule) => {
  const results = await lint.lintText(text, { filePath: `src/${file}` });
  const found = results.flatMap(({ messages }) =>
    messages.flatMap(({ ruleId }) =>
      ruleId === "import-x/no-restricted-paths" || ruleId === "no-restricted-syntax"
        ? [ruleId]
        : [],
    ),
  );
  expect(found).toEqual(rule === undefined ? [] : [rule]);
});
