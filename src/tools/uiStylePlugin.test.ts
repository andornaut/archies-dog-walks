import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CELEBRATION_STYLE } from "../ui/dom/celebrationStyle.ts";
import { UI_STYLE } from "../ui/dom/uiStyle.ts";
import { buttonSkinManifest, UI_STYLESHEET_ID, uiStylePlugin } from "./uiStylePlugin.ts";

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

it("resolves this build's button manifest to hashed resources under a non-root base", () => {
  const files = new Map([
    ["sprites/ui-button.json", "assets/art/sprites/ui-button-abc123.json"],
    ["sprites/ui-button.png", "assets/art/sprites/ui-button-def456.png"],
    ["sprites/ui-icon-button.json", "assets/art/sprites/ui-icon-button-ghi789.json"],
    ["sprites/ui-icon-button.png", "assets/art/sprites/ui-icon-button-jkl012.png"],
  ]);
  const skin = JSON.parse(buttonSkinManifest(files)) as {
    sprites: { json: string; key: string; png: string }[];
  };
  const manifest = new URL("https://example.test/game/assets/button-skin-hashed.json");
  expect(
    skin.sprites.map(({ json, png }) => [
      new URL(json, manifest).pathname,
      new URL(png, manifest).pathname,
    ]),
  ).toEqual([
    [
      "/game/assets/art/sprites/ui-button-abc123.json",
      "/game/assets/art/sprites/ui-button-def456.png",
    ],
    [
      "/game/assets/art/sprites/ui-icon-button-ghi789.json",
      "/game/assets/art/sprites/ui-icon-button-jkl012.png",
    ],
  ]);
  expect(() => buttonSkinManifest(new Map())).toThrow("Button skin art was not emitted");
});
