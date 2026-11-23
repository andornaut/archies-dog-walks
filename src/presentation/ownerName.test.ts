import { fontMetrics } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import {
  END_LAYOUT,
  endPanelLayout,
  endResultsPlacement,
  quipNameBottom,
} from "../home/endLayout.ts";
import { gameFont } from "../testing/fontInk.ts";
import { ownerNameWrap } from "./ownerName.ts";

const body = gameFont("font-body");
const names = [...new Set(Object.values(gameData.dogs).map((dog) => dog.owner.name))];

// Whether lines are the name's words in order, each line whole words joined by single spaces.
const wholeWords = (name: string, lines: readonly { text: string }[]) =>
  lines.map((line) => line.text).join(" ") === name &&
  lines.every((line) => line.text.trim() === line.text && line.text !== "");

it.each(names)("wraps %s in the results column only at spaces", (name) => {
  const lines = ownerNameWrap(body, END_LAYOUT.quips.name.room, name);
  expect(wholeWords(name, lines)).toBe(true);
  expect(lines.length).toBeLessThanOrEqual(2);
});

it.each([
  ["a word wider than the column keeps its own whole line", "Gadget", ["Gadget"]],
  ["two words wrap at their space", "Aunt Judy", ["Aunt", "Judy"]],
])("results column: %s", (_case, name, expected) => {
  expect(ownerNameWrap(body, END_LAYOUT.quips.name.room, name).map((line) => line.text)).toEqual(
    expected,
  );
});

it("retains the tallest actual three-owner blocks within bounded badge allocations", () => {
  const fonts = { body: fontMetrics(body), title: fontMetrics(gameFont("font-title")) };
  const owners = names
    .map((name) => ({
      fired: true,
      lines: 1,
      nameBottom: quipNameBottom(
        fonts,
        { fired: true, lines: 1 },
        ownerNameWrap(body, END_LAYOUT.quips.name.room, name),
      ),
    }))
    .sort((a, b) => b.nameBottom - a.nameBottom)
    .slice(0, 3);
  const natural = endPanelLayout(fonts, 5, owners);
  for (const [badgeRows, overflow] of [
    [0, 0],
    [1, 51],
    [2, 63],
  ] as const) {
    const placed = endResultsPlacement(badgeRows, natural);
    const { contentHeight, viewport } = placed.ownerRows;
    expect(contentHeight - viewport.height).toBe(overflow);
    expect(placed.panel.y).toBeGreaterThanOrEqual(END_LAYOUT.panel.y);
    expect(placed.panel.y + placed.panel.height).toBeLessThanOrEqual(placed.strip.y);
    const last = natural.rows.at(-1)!;
    expect(viewport.y + contentHeight).toBe(last.top + last.height);
    natural.rows.forEach((row, index) =>
      expect(row.height).toBeGreaterThanOrEqual(owners[index]!.nameBottom),
    );
  }
});
