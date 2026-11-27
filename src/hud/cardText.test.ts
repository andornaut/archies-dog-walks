import { keysOf } from "@andornaut/game-kit/runtime/records";
import { inkRowsOfLines } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { fitsRoom, fittingText, type TextFitStyle } from "@andornaut/game-kit/runtime/text/textFit";
import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import type { ZoneId } from "../data/types.ts";
import { CARD_LAYOUT, cardEffectArea, plaqueRoom } from "../presentation/cardLayout.ts";
import { withNamePills } from "../presentation/effectNames.ts";
import { cardFor, hasPlaque, type OptionView } from "../rules/choices.ts";
import { upgradeLine } from "../rules/effectText.ts";
import { defined } from "../testing/defined.ts";
import { everyCardOption } from "../testing/everyCardOption.ts";
import { fontFileMetrics, gameFont, inkWidth } from "../testing/fontInk.ts";
import { testState } from "../testing/runState.ts";
import { plainMarks } from "../ui/pixelFont.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";
import { plaqueTexts, smallCardText } from "./cardText.ts";

const BODY = fontFileMetrics("font-body");
const body = (text: string) => plainMarks(text);

const CASES = everyCardOption();
const firesOf = (option: OptionView | undefined) =>
  option === undefined || option.fires.length === 0 ? null : option.fires;
const bodyWidth = (style: TextFitStyle, line: string) => inkWidth("font-body", style, body(line));

function fitsBody2(lines: readonly string[], room: number, rows: number): boolean {
  const { glyphs, lineHeight } = gameFont("font-body");
  const ink = lines.flatMap((line, index) =>
    [...line].flatMap((letter) => {
      const glyph = glyphs.get(letter)!;
      const top = index * lineHeight + glyph.yOffset;
      return glyph.height > 0 ? [{ bottom: top + glyph.height, top }] : [];
    }),
  );
  const top = Math.min(...ink.map((glyph) => glyph.top));
  const bottom = Math.max(...ink.map((glyph) => glyph.bottom));
  return (
    lines.every((line) => bodyWidth({ scale: TEXT_SCALE }, line) <= room) &&
    (bottom - top) * TEXT_SCALE <= rows
  );
}

// The names of the cards that fitsOn rejects.
const misfits = (fitsOn: (option: OptionView | undefined) => boolean) =>
  CASES.filter(([, option]) => !fitsOn(option)).map(([name]) => name);

describe("every card the data can deal", () => {
  it("fits the full name at Body2 in up to two small rows and one held row", () => {
    const { band, large } = CARD_LAYOUT;
    expect(
      misfits((option) => {
        const label = option?.label ?? gameData.runText.card.skip;
        const small = fittingText({ lines: 2, scale: TEXT_SCALE }, bodyWidth, band.room, label);
        return (
          small.lines.length <= 2 &&
          small.lines.join(" ") === label &&
          fitsBody2(small.lines, band.room, band.height) &&
          fitsBody2([label], large.band.room, large.band.height)
        );
      }),
    ).toEqual([]);
  });

  // The warning ends on the effect box's foot, where it shows (every effect and warning fits its
  // box: ui/textRoles.test.ts).
  it("sets its firing warning's lowest ink on the effect box's foot", () => {
    const area = cardEffectArea(BODY, true);
    expect(
      misfits((option) => {
        const { box, warning } = smallCardText(gameData, BODY, bodyWidth, option);
        return (
          warning === null ||
          box.warningY + inkRowsOfLines(BODY, warning.lines.length) === area.y + area.height
        );
      }),
    ).toEqual([]);
  });

  it("fits a plaque text in the plaque beside any fires marker, small and enlarged", () => {
    const { badge, badgeSlices: slices, fires: marker, large } = CARD_LAYOUT;
    expect(
      misfits((option) => {
        if (!hasPlaque(option)) {
          return true;
        }
        const fired = firesOf(option) !== null;
        const caps = slices.left + slices.right;
        const small = plaqueRoom(
          badge.x + slices.left,
          badge.width - caps,
          fired ? marker.x + marker.size : undefined,
        );
        const enlarged = plaqueRoom(
          large.badge.x + 2 * slices.left,
          large.badge.width - 2 * caps,
          fired ? large.fires.x + 2 * marker.size : undefined,
        );
        const texts = [...plaqueTexts(gameData, option), gameData.runText.card.free];
        return texts.every(
          (text) =>
            fitsBody2([text], small, badge.face.height) &&
            fitsBody2([text], enlarged, large.badge.face.height),
        );
      }),
    ).toEqual([]);
  });
});

// Any fork may offer any upgrade not yet picked, so each one's path card says what it does
// (each fits its box: ui/textRoles.test.ts).
describe("a path card", () => {
  const zone = defined(gameData.world.zones[0]).id as ZoneId;
  it.each(keysOf(gameData.upgrades))(
    "carrying %s shows the upgrade's name in its pill over its cardEffect on the small card",
    (upgrade) => {
      const { name } = gameData.upgrades[upgrade];
      const line = upgradeLine(gameData.tuning, "cardEffect", gameData.upgrades[upgrade]);
      expect(line.trim()).not.toBe("");
      const option = defined(
        cardFor(gameData, testState({ kilo: 5 }), {
          kind: "fork",
          paths: [zone],
          upgrades: [upgrade],
        }).options[0],
      );
      const { effect } = smallCardText(gameData, BODY, bodyWidth, option);
      expect(effect.lines.join(" ")).toBe(withNamePills(gameData, `${name}: ${line}`));
      expect(fitsRoom(bodyWidth, CARD_LAYOUT.effect.width, effect)).toBe(true);
    },
  );
});
