import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import gameData from "../../shared/export/game-data.json" with { type: "json" };
import palette from "../../shared/palette.json" with { type: "json" };
import verges from "../../shared/verges.json" with { type: "json" };

// public/art/index.html holds its own copies of the zones' road colours and the house palette, so
// these tests hold them to the exports.
const GALLERY = readFileSync(new URL("../../public/art/index.html", import.meta.url), "utf8");

// The gallery's ground swatches, title to value, without the checker.
function groundSwatches(): Map<string, string> {
  const swatches = [
    ...GALLERY.matchAll(
      /<label class="gr" title="([^"]+)"><input type="radio" name="ground" value="([^"]+)"/gu,
    ),
  ];
  return new Map(
    swatches
      .map(([, title, value]) => [title, value] as [string, string])
      .filter(([, value]) => value !== "checker"),
  );
}

// The gallery's palette list (PAL), name to hex.
function galleryPalette(): Record<string, string> {
  const list = /const PAL = "([^"]+)"/u.exec(GALLERY)?.[1] ?? "";
  return Object.fromEntries(list.split(" ").map((entry) => entry.split(":") as [string, string]));
}

const hexOf = (name: string) => `#${palette[name as keyof typeof palette].hex}`;

describe("art gallery", () => {
  it("offers each zone's road and the High Park verge as grounds in their colours", () => {
    const swatches = groundSwatches();
    const roads = gameData.zones.map(({ name }) => {
      const title = [...swatches.keys()].find((key) => key.startsWith(`${name} road`));
      return [name, title === undefined ? undefined : swatches.get(title)];
    });
    expect(swatches.get("High Park verge")).toBe(hexOf(verges["high-park"].walkColour));
    expect(roads).toEqual(gameData.zones.map(({ name, roadColour }) => [name, roadColour]));
  });

  it("draws every ground in a palette colour", () => {
    const colours = new Set(Object.keys(palette).map(hexOf));
    expect([...groundSwatches().values()].filter((value) => !colours.has(value))).toEqual([]);
  });

  it("lists the house palette's colours by name, without the picker-only tones", () => {
    const house = Object.entries(palette)
      .filter(([name]) => !name.startsWith("picker"))
      .map(([name, { hex }]) => [name, hex]);
    expect(galleryPalette()).toEqual(Object.fromEntries(house));
  });
});
