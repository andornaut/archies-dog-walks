import { describe, expect, it } from "vitest";

import { shopPageView } from "../../home/shopPageView.ts";
import { FakeDocument, type FakeElement } from "../../testing/fakeDom.ts";
import { gameFont } from "../../testing/fontInk.ts";
import { domScale } from "../../ui/domScale.ts";
import type { PanelMeasure } from "../questionPanelView.ts";
import { shopPageParts } from "./shopPage.ts";

const MEASURE: PanelMeasure = {
  body: { capHeight: 6, capTop: 2, inkBottom: 9, letterTop: 1, lineHeight: 10 },
  inkWidth: (_font, line) => line.length * 12,
  title: { capHeight: 5, capTop: 4, inkBottom: 10, letterTop: 2, lineHeight: 12 },
  wrapNote: (_width, text) => [text],
};

const LABELS = ["Badges", "Dogs", "Walks"];

// Each tab face's width in CSS px with the open tab at open, on a 393x652 phone's canvas box (a
// game pixel 1.086 CSS px, the box a CSS px in) at dpr.
function faceWidths(dpr: number, open: number): number[] {
  const doc = new FakeDocument();
  const view = shopPageView(MEASURE, {
    closePressed: false,
    tabs: LABELS.map((label, i) => ({ label, open: i === open, pressed: false })),
    title: "Logbook",
  });
  const scale = domScale(dpr, { height: 608, width: 390.844, x: 1, y: 0 });
  const parts = shopPageParts(doc as unknown as Document, gameFont("font-title"), view).slice(
    -LABELS.length,
  );
  return parts.map((part) => {
    part.place(scale);
    const group = (part.element as unknown as FakeElement).children.at(-1);
    const face = group?.children[0];
    return Number.parseFloat(face?.style.width ?? "") / dpr;
  });
}

describe("the HTML page's tabs", () => {
  it("keep each face's width whichever tab is open, at every DPR", () => {
    const widths = [1, 2, 3].flatMap((dpr) => LABELS.map((_label, open) => faceWidths(dpr, open)));
    for (const each of widths) {
      expect(each).toEqual(widths[0]);
    }
  });
});
