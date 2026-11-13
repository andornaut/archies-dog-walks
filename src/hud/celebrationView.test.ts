import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { PALETTE } from "../ui/palette.ts";
import { cents } from "../units.ts";
import { CELEBRATION_LAYOUT } from "./celebrationLayout.ts";
import { type CelebrationMeasure, zoneCelebrationView } from "./celebrationView.ts";
import { celebrationText } from "./zoneCelebration.ts";

// Every character inks 5 columns of a 6-column advance at 2x, and every icon is 16 wide.
const MEASURE: CelebrationMeasure = {
  art: () => ({ height: 16, width: 16 }),
  body: { capHeight: 6, capTop: 2, inkBottom: 9, letterTop: 1, lineHeight: 10 },
  bodyWidth: (lines) => Math.max(0, ...lines.map((line) => line.length * 12)),
  fitGreeting: (text) => ({ lines: [text], style: { lines: 2, scale: 2 } }),
  hasTag: () => false,
  inkWidth: (_font, line) => line.length * 12 - 2,
  title: { capHeight: 5, capTop: 4, inkBottom: 10, letterTop: 2, lineHeight: 12 },
  wrapBody: (_width, text) => [text],
  wrapNote: (_width, text) => [text],
};

const ZONE_DONE = celebrationText(gameData, {
  fees: cents(1250),
  kind: "zoneDone",
  tips: cents(300),
  walker: "casey",
  zone: "High Park",
});

describe("zoneCelebrationView", () => {
  it("sets the earnings on one centred line, each amount a forest run of it", () => {
    const view = zoneCelebrationView(MEASURE, undefined, ZONE_DONE);
    expect(view.texts).toHaveLength(1);
    const [line] = view.texts;
    const money = ZONE_DONE.kind === "zoneDone" ? ZONE_DONE.earnings : [];
    expect(line?.spans?.map(({ text }) => text).join("")).toBe(line?.lines[0]);
    expect(
      line?.spans?.filter(({ colour }) => colour === PALETTE.forest).map(({ text }) => text),
    ).toEqual(money.filter(({ kind }) => kind === "money").map(({ text }) => text));
    expect([line?.align, line?.x]).toEqual(["centre", CELEBRATION_LAYOUT.centreX]);
    expect(view.frame.key).toBe("ui-panel");
    expect(line?.backing).toEqual(view.frame.rect);
  });

  it("sets key 1 and the label gap apart, centred together on the face, once numbers show", () => {
    const gap = 16;
    const { button } = zoneCelebrationView(MEASURE, { gap }, ZONE_DONE);
    const ink = (text: string) => text.length * 12 - 2;
    const keyLeft = (button.key?.centreX ?? 0) - ink("1") / 2;
    const labelLeft = button.text.centreX - ink(button.label) / 2;
    expect(labelLeft - (keyLeft + ink("1"))).toBe(gap);
    const middle = (keyLeft + labelLeft + ink(button.label)) / 2;
    expect(Math.abs(middle - (button.rect.x + button.rect.width / 2))).toBeLessThanOrEqual(0.5);
    expect(zoneCelebrationView(MEASURE, undefined, ZONE_DONE).button.key).toBeUndefined();
  });

  it("centres a new walker's greeting, its info lines and its rule, the tail held by the bubble", () => {
    const text = celebrationText(gameData, { kind: "newWalker", walker: "ada" });
    const view = zoneCelebrationView(MEASURE, undefined, text);
    const { rect } = view.frame;
    expect(view.texts.map(({ align, x }) => [align, x])).toEqual(
      view.texts.map(() => ["centre", CELEBRATION_LAYOUT.centreX]),
    );
    expect(view.frame.key).toBe("ui-quip");
    expect(view.art[0]).toMatchObject({ holder: { x: rect.x, y: rect.y } });
    expect(view.rows.map(({ centreX }) => centreX)).toEqual(
      view.rows.map(() => CELEBRATION_LAYOUT.centreX),
    );
    const rule = view.rule;
    const room = {
      from: rect.x + (rule?.inset ?? 0),
      to: rect.x + rect.width - (rule?.inset ?? 0) - 1,
    };
    const last = (rule?.fromX ?? 0) + ((rule?.dots ?? 1) - 1) * (rule?.step ?? 0);
    const [before, after] = [(rule?.fromX ?? 0) - room.from, room.to - last];
    expect(before >= 0 && after >= 0 && after - before <= 1 && after < (rule?.step ?? 0)).toBe(
      true,
    );
  });
});
