import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import noCycle from "eslint-plugin-import-x/rules/no-cycle";
import { expect, it } from "vitest";

it("keeps the game cycle policy wired to the selective public rule and resolver", async () => {
  const cwd = fileURLToPath(new URL("../../", import.meta.url));
  const config = await new ESLint({ cwd }).calculateConfigForFile("src/tools/lintConfiguration.ts");
  expect(config?.rules?.["import-x/no-cycle"]).toEqual([2]);
  expect(config?.plugins?.["import-x"]?.rules?.["no-cycle"]).toBe(noCycle);
  expect(config?.settings?.["import-x/extensions"]).toEqual([".ts"]);
  expect(config?.settings?.["import-x/resolver-next"]).toEqual([
    expect.objectContaining({ resolve: expect.any(Function) }),
  ]);
});
