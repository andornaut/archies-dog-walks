import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import { expect, it } from "vitest";

const lint = new ESLint({ cwd: fileURLToPath(new URL("../../", import.meta.url)) });

it.each([
  ["hud/probe.test.ts", "../testing/probe.ts", false],
  ["scenes/probe.ts", "phaser", false],
  ["tools/probe.ts", "../testing/probe.ts", true],
  ["ui/dom/probe.ts", "../../scenes/uiKit.ts", true],
  ["ui/dom/probe.ts", "phaser", true],
])(
  "holds src/%s importing %s to the Phaser and testing boundaries",
  async (file, path, forbidden) => {
    const results = await lint.lintText(`import { value } from "${path}"; void value;`, {
      filePath: `src/${file}`,
    });
    const violations = results.flatMap(({ messages }) =>
      messages.filter(({ ruleId }) => ruleId === "no-restricted-imports"),
    );
    expect(violations.length > 0).toBe(forbidden);
  },
);

it.each([
  ["save/probe.ts", 'import "../rules/index.ts";', undefined],
  ["tools/probe.ts", 'import "./atlas/index.ts";', undefined],
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
  ["hud/probe.ts", 'import "../assets/index.ts";', undefined],
  ["hud/probe.ts", 'import "../assets/manifest.ts";', "import-x/no-restricted-paths"],
  ["hud/probe.ts", 'import "../data/layout.ts";', "import-x/no-restricted-paths"],
  ["hud/probe.ts", 'import "../data/world.ts";', undefined],
  ["save/probe.ts", 'import "../rules/causes.ts";', "import-x/no-restricted-paths"],
  ["assets/probe.ts", 'import "./manifest.ts";', undefined],
  ["homePage/probe.ts", 'import "../pwa/cachePolicy.ts";', undefined],
  ["homePage/probe.ts", 'import "../pwa/launch.ts";', "import-x/no-restricted-paths"],
  ["tools/probe.ts", 'import "./atlas/atlasLayout.ts";', "import-x/no-restricted-paths"],
  ["tools/plannerAcceptance/probe.ts", 'import "../usage.ts";', "import-x/no-restricted-paths"],
  ["main.ts", 'import "./crash/crashScreen.ts";', "import-x/no-restricted-paths"],
])("holds src/%s with %s to the bands and the entries", async (file, text, rule) => {
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

it("refuses a module that imports its own group's entry, which imports it back", async () => {
  const results = await lint.lintText('import "./index.ts";', { filePath: "src/data/layout.ts" });
  const rules = results.flatMap(({ messages }) => messages.map(({ ruleId }) => ruleId));
  expect(rules).toContain("import-x/no-cycle");
});
