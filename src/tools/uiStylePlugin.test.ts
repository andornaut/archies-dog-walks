import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CELEBRATION_STYLE } from "../ui/dom/celebrationStyle.ts";
import { UI_STYLE } from "../ui/dom/uiStyle.ts";
import { UI_STYLESHEET_ID, uiStylePlugin } from "./uiStylePlugin.ts";

const DOM_DIR = join(import.meta.dirname, "../ui/dom");

interface Hook<Handler> {
  filter: { id: RegExp };
  handler: Handler;
}
type ResolveId = Hook<() => string>;
type Load = Hook<(this: { addWatchFile(file: string): void }) => Promise<string>>;

describe("the HTML interface's stylesheet module", () => {
  it("serves the interface's styles as CSS and watches their sources", async () => {
    const plugin = uiStylePlugin({ source: join(DOM_DIR, "uiStylesheet.ts") });
    const resolveId = plugin.resolveId as ResolveId;
    const load = plugin.load as Load;
    const id = resolveId.handler();
    const watched: string[] = [];

    const css = await load.handler.call({ addWatchFile: (file) => watched.push(file) });

    expect(
      [UI_STYLESHEET_ID, `${UI_STYLESHEET_ID}x`].map((x) => resolveId.filter.id.test(x)),
    ).toEqual([true, false]);
    expect([id, `${id}?inline`, UI_STYLESHEET_ID].map((x) => load.filter.id.test(x))).toEqual([
      true,
      false,
      false,
    ]);
    expect(id).toMatch(/\.css$/);
    expect(css).toBe(UI_STYLE + CELEBRATION_STYLE);
    expect(watched).toEqual(
      expect.arrayContaining([
        join(DOM_DIR, "celebrationStyle.ts"),
        join(DOM_DIR, "uiStyle.ts"),
        join(DOM_DIR, "../../data/layout.ts"),
      ]),
    );
  });
});
