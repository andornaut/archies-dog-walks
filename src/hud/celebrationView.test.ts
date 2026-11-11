import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
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
  it("draws each amount in forest over its place in the earnings line", () => {
    const view = zoneCelebrationView(MEASURE, undefined, ZONE_DONE);
    const [whole, ...amounts] = view.texts;
    const line = whole?.lines[0] ?? "";
    const money = ZONE_DONE.kind === "zoneDone" ? ZONE_DONE.earnings : [];
    expect(amounts.map(({ lines }) => lines[0])).toEqual(
      money.filter(({ kind }) => kind === "money").map(({ text }) => text),
    );
    for (const amount of amounts) {
      const at = line.indexOf(amount.lines[0] ?? "");
      expect(amount.x).toBe((whole?.x ?? 0) + at * 12);
      expect(amount.capTop).toBe(whole?.capTop);
    }
    expect(view.frame.key).toBe("ui-panel");
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

  it("centres a new walker's greeting on the screen in its bubble, under its tail", () => {
    const text = celebrationText(gameData, { kind: "newWalker", walker: "ada" });
    const view = zoneCelebrationView(MEASURE, undefined, text);
    const [greeting] = view.texts;
    const width = (greeting?.lines[0]?.length ?? 0) * 12;
    expect((greeting?.x ?? 0) + width / 2).toBe(CELEBRATION_LAYOUT.centreX);
    expect(view.frame.key).toBe("ui-quip");
    expect(view.art[0]).toMatchObject(CELEBRATION_LAYOUT.newWalker.tail);
    expect(view.rule?.y).toBeGreaterThan(greeting?.capTop ?? Infinity);
  });
});
