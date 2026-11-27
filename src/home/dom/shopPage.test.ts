import { describe, expect, it } from "vitest";

import { FakeDocument, type FakeElement } from "../../testing/fakeDom.ts";
import { gameFont } from "../../testing/fontInk.ts";
import { domScale } from "../../ui/domScale.ts";
import { modalTitleInk } from "../../ui/modal/titleRole.ts";
import type { PanelMeasure } from "../../ui/modal/types.ts";
import { shopTabRects } from "../shopLayout.ts";
import { shopPageView } from "../shopPageView.ts";
import { createPageTab } from "./shopPage.ts";

const MEASURE: PanelMeasure = {
  body: { capHeight: 6, capTop: 2, inkBottom: 9, letterTop: 1, lineHeight: 10 },
  inkWidth: (_font, line) => line.length * 12,
  title: { capHeight: 5, capTop: 4, inkBottom: 10, letterTop: 2, lineHeight: 12 },
  titleInk: (line: string) => modalTitleInk(gameFont("font-title"), line),
  wrapNote: (_width, text) => [text],
};

const LABELS = ["Badges", "Dogs", "Walks"];

// Each tab face's dimensions in CSS px with the open tab at open, on a 393x652 phone's canvas box (a
// game pixel 1.086 CSS px, the box a CSS px in) at dpr.
function faceBoxes(dpr: number, open: number): { top: number; width: number }[] {
  const doc = new FakeDocument();
  const view = shopPageView(MEASURE, {
    tabs: LABELS.map((label, i) => ({ label, open: i === open })),
    title: "Logbook",
  });
  const scale = domScale(dpr, { height: 608, width: 390.844, x: 1, y: 0 });
  const hits = shopTabRects(LABELS.length);
  return view.tabs.map((tab, index) => {
    const part = createPageTab(
      doc as unknown as Document,
      {
        font: gameFont("font-title"),
        press: { accepts: () => true, burst: () => undefined, press: () => undefined },
      },
      hits[index]!,
      tab,
    );
    part.place(scale);
    const button = part.element as unknown as FakeElement;
    const face = button.children[0];
    const top = Number.parseFloat(face?.style.top ?? "") / dpr;
    const width = Number.parseFloat(face?.style.width ?? "") / dpr;
    expect(button.classList.contains("adw-selectable-button")).toBe(true);
    expect(button.hasAttribute("data-ui-selected")).toBe(index === open);
    expect(width).toBeGreaterThan(0);
    part.dispose();
    return { top, width };
  });
}

describe("the HTML page's tabs", () => {
  it("keep each face in the same place whichever tab is open, at every DPR", () => {
    const fitted = [1, 2, 3].map((dpr) => LABELS.map((_label, open) => faceBoxes(dpr, open)));
    const widths = fitted[0]![0]!.map(({ width }) => width);
    for (const boxes of fitted) {
      for (const each of boxes) {
        expect(each).toEqual(boxes[0]);
        expect(each.map(({ width }) => width)).toEqual(widths);
      }
    }
  });
});
