import { fontMetrics } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { END_LAYOUT, endPanelLayout, endResultsPlacement } from "../home/endLayout.ts";
import { DOG_CARD, ownerNameLines } from "../hud/walkHud.ts";
import { fontInk, fontInkRows, gameFont } from "../testing/fontInk.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";
import { ownerNameLayout } from "./ownerName.ts";

const body = gameFont("font-body");
const names = [...new Set(Object.values(gameData.dogs).map((dog) => dog.owner.name))];

it.each(names)("fits %s at full size in the HUD and results owner columns", (name) => {
  for (const room of [DOG_CARD.owner.room, END_LAYOUT.quips.name.room]) {
    const lines = ownerNameLayout(body, room, name);
    expect(lines.length).toBeGreaterThanOrEqual(1);
    expect(lines.length).toBeLessThanOrEqual(2);
    expect(
      lines
        .map((line) => line.text)
        .join("")
        .replaceAll(" ", ""),
    ).toBe(name.replaceAll(" ", ""));
    for (const line of lines) {
      const columns = fontInk("font-body", { scale: TEXT_SCALE }, line.text);
      const rows = fontInkRows("font-body", { scale: TEXT_SCALE }, line.text);
      expect(line.ink).toEqual({
        bottom: rows.bottom,
        left: columns.left,
        right: columns.right,
        top: rows.top,
      });
      expect(line.ink.right - line.ink.left).toBeLessThanOrEqual(room);
    }
  }
  const hud = ownerNameLines(body, name);
  if (hud.length === 1) {
    expect(hud[0]!.top + (hud[0]!.ink.top + hud[0]!.ink.bottom) / 2).toBe(
      DOG_CARD.owner.ink.centreY,
    );
  } else {
    hud.forEach((line, index) => {
      expect(line.top + line.ink.top).toBe(DOG_CARD.owner.ink.tops[index]);
      expect(line.top + line.ink.bottom).toBeLessThanOrEqual(DOG_CARD.hearts.y);
    });
  }
});

it("retains the tallest actual three-owner blocks within bounded badge allocations", () => {
  const owners = names
    .map((name) => ({
      fired: true,
      lines: 1,
      nameBottom: Math.max(
        ...ownerNameLayout(body, END_LAYOUT.quips.name.room, name).map(
          (line, index) =>
            END_LAYOUT.quips.nameY + index * END_LAYOUT.quips.name.linePitch + line.ink.bottom,
        ),
      ),
    }))
    .sort((a, b) => b.nameBottom - a.nameBottom)
    .slice(0, 3);
  const fonts = { body: fontMetrics(body), title: fontMetrics(gameFont("font-title")) };
  const natural = endPanelLayout(fonts, 5, owners);
  for (const [badgeRows, overflow] of [
    [0, 0],
    [1, 61],
    [2, 73],
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
