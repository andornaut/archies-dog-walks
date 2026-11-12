import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import palette from "../../shared/palette.json" with { type: "json" };

const GAME_ENTRY = new URL("../main.ts", import.meta.url);
const GAME_PAGE = new URL("../../pages/play/index.html", import.meta.url);
const HOME_PAGE = new URL("../../pages/index.html", import.meta.url);
const PAGE_CSS = new URL("../main.css", import.meta.url);
const WEB_MANIFEST = new URL("../../public/manifest.webmanifest", import.meta.url);

async function manifest(): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(WEB_MANIFEST, "utf8"));
}

// Everything that colours the space around the game's canvas: the letterbox bands, the status
// bar, the installed app's launch screen and the canvas's own clear colour before any scene
// draws. Each takes art's ink (shared/palette.json), set apart from the top bars' plum.
const AROUND_THE_GAME: [string, () => Promise<unknown>][] = [
  [
    "the page's background",
    async () =>
      /html,\s*body\s*\{[^}]*background:\s*(#[0-9a-f]{6});/u.exec(
        await readFile(PAGE_CSS, "utf8"),
      )?.[1],
  ],
  [
    "Phaser's backgroundColor",
    async () =>
      /backgroundColor:\s*"(#[0-9a-f]{6})"/u.exec(await readFile(GAME_ENTRY, "utf8"))?.[1],
  ],
  ["the manifest's background_color", async () => (await manifest()).background_color],
  ["the manifest's theme_color", async () => (await manifest()).theme_color],
  [
    "/play/'s theme-color meta",
    async () =>
      /<meta name="theme-color" content="([^"]*)"/u.exec(await readFile(GAME_PAGE, "utf8"))?.[1],
  ],
];

describe("the space around the game", () => {
  it.each(AROUND_THE_GAME)("takes the palette's ink in %s", async (_place, colour) => {
    expect(await colour()).toBe(`#${palette.ink.hex}`);
  });
});

// The home page's status bar takes the colour of the page behind it: its body background.
describe("the home page's theme colour", () => {
  it("is its body background, the palette's ink", async () => {
    const html = await readFile(HOME_PAGE, "utf8");
    const name = /body\s*\{[^}]*background:\s*var\(--([a-z]+)\)/u.exec(html)?.[1] ?? "";
    const background = new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`, "u").exec(html)?.[1];
    const theme = /<meta name="theme-color" content="([^"]*)"/u.exec(html)?.[1];
    expect({ background, theme }).toEqual({
      background: `#${palette.ink.hex}`,
      theme: `#${palette.ink.hex}`,
    });
  });
});
