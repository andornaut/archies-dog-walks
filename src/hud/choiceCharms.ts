import type { Rect } from "@andornaut/game-kit/runtime/rect";
import { type BitmapFont, inkWidth } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { fittingText } from "@andornaut/game-kit/runtime/text/textFit";

import { CHARM, WALK_BAR_PARTS } from "../data/index.ts";
import { cardCharmPlates, cardCharmWidth } from "../layout/index.ts";
import { plainMarks, TEXT_SCALE } from "../ui/index.ts";
import type { CardCharm } from "./buffMarks.ts";

type Role = "body" | "title";

export interface ChoiceCharmPlate {
  readonly charm: CardCharm;
  readonly labels: readonly { readonly face: Rect; readonly font: Role; readonly text: string }[];
  readonly rect: Rect;
}

function measuredLines(bitmap: BitmapFont, room: number, role: Role, text: string) {
  const plain = plainMarks(text);
  const shown = role === "title" ? plain.toUpperCase() : plain;
  const measure = (line: string) => inkWidth(bitmap, TEXT_SCALE, line);
  return fittingText(
    { lines: 2, scale: TEXT_SCALE },
    (_style, line) => measure(line),
    room,
    shown,
  ).lines.map((line) => {
    const glyphs = [...line].flatMap((char) => {
      const glyph = bitmap.glyphs.get(char);
      return glyph === undefined || glyph.height === 0 ? [] : [glyph];
    });
    const top = Math.min(...glyphs.map(({ yOffset }) => yOffset));
    const bottom = Math.max(...glyphs.map(({ height, yOffset }) => yOffset + height));
    return {
      font: role,
      height: glyphs.length === 0 ? 0 : (bottom - top) * TEXT_SCALE,
      text: line,
      width: measure(line),
    };
  });
}

export function choiceCharmStack(
  fonts: Readonly<Record<Role, BitmapFont>>,
  cardWidth: number,
  charms: readonly CardCharm[],
): { readonly height: number; readonly place: (card: Rect) => ChoiceCharmPlate[] } {
  const { padY, rowGap, textX } = CHARM.card;
  const cell = WALK_BAR_PARTS.effects.size;
  const room = cardWidth - cardCharmWidth(0) - 2 * CHARM.ring;
  const contents = charms.map((charm) => {
    const rows = [
      ...measuredLines(fonts.body, room, "body", charm.name),
      ...(charm.effect === null ? [] : measuredLines(fonts.title, room, "title", charm.effect)),
    ];
    const inkHeight = rows.reduce((sum, row) => sum + row.height, 0) + (rows.length - 1) * rowGap;
    return {
      height: Math.max(cell, inkHeight + 2 * padY),
      inkHeight,
      rows,
      width: cardCharmWidth(Math.max(...rows.map((row) => row.width))),
    };
  });
  const local = cardCharmPlates({ height: 0, width: cardWidth, x: 0, y: 0 }, contents);
  const last = local.at(-1);
  const height = last === undefined ? 0 : last.y + last.height + CHARM.ring;
  const place = (card: Rect) =>
    local.map((plate, index) => {
      const rect = { ...plate, x: plate.x + card.x, y: plate.y + card.y + card.height };
      const { inkHeight, rows } = contents[index]!;
      const x = rect.x + cell + textX;
      let y = rect.y + Math.floor((rect.height - inkHeight) / 2);
      const labels = rows.map(({ font, height, text, width }) => {
        const face = { height, width, x, y };
        y += height + rowGap;
        return { face, font, text };
      });
      return { charm: charms[index]!, labels, rect };
    });
  return { height, place };
}
