import type { Rect } from "@andornaut/game-kit/rect";
import { describe, expect, it } from "vitest";

import { fontFileMetrics, inkWidth } from "../testing/fontInk";
import { cardTitles } from "../testing/textRoles";
import { BAR_TITLE, barTitleLeft, barTitleRoom } from "../ui/barTitle";
import { type CloseControl, closeControl } from "../ui/closeControl";
import { plainMarks } from "../ui/pixelFont";
import { TEXT_STYLE } from "../ui/textFit";
import { cardTitleRow } from "./homeLayout";
import { modalTitleLayout } from "./modalLayout";

// The clear space on either side of title ink, after the correct corner-control reservation.
function clearSpace(bar: Rect, close: CloseControl, width: number) {
  const left = barTitleLeft(bar, close, width);
  const end = (close.titleExclusion === "hit" ? close.hit.x : close.x) - BAR_TITLE.closeGap;
  const start = close.titleExclusion === "hit" ? 2 * bar.x + bar.width - end : bar.x;
  return { left: left - start, right: end - (left + width) };
}

// A centred title has the same clear space each side, to within the odd pixel, at least inset;
// one too wide for that starts inset in.
function expectPlaced(bar: Rect, close: CloseControl, width: number): void {
  const { left, right } = clearSpace(bar, close, width);
  if (left > BAR_TITLE.inset) {
    expect(right - left).toBeGreaterThanOrEqual(0);
    expect(right - left).toBeLessThanOrEqual(1);
  } else {
    expect(left).toBe(BAR_TITLE.inset);
    expect(right).toBeLessThanOrEqual(BAR_TITLE.inset + 1);
  }
}

describe("barTitleLeft", () => {
  const card: Rect = { height: 100, width: 300, x: 30, y: 0 };
  const bar = cardTitleRow(card);
  const close = closeControl(card);
  const room = barTitleRoom(bar, close);

  it.each([
    ["a short title", 40],
    ["an odd width", 41],
    ["a title with exactly inset each side", room - 2 * BAR_TITLE.inset],
    ["a title a pixel too wide to centre", room - 2 * BAR_TITLE.inset + 1],
    ["a title too wide to centre", room - BAR_TITLE.inset - BAR_TITLE.closeGap],
  ])("places %s centred or at the inset", (_, width) => {
    expectPlaced(bar, close, width);
  });

  it.each([
    ["centres a title with room for inset each side", room - 2 * BAR_TITLE.inset, "centre"],
    ["starts a wider title at the inset", room - 2 * BAR_TITLE.inset + 2, "left"],
  ])("%s", (_, width, placed) => {
    const { left, right } = clearSpace(bar, close, width);
    expect(left === right ? "centre" : "left").toBe(placed);
  });
});

describe.each(cardTitles())("the $role", ({ card, close = closeControl(card), titles }) => {
  const bar = cardTitleRow(card);

  it.each(titles)("centres every line of %s with symmetric close clearance", (title) => {
    const widthOf = (line: string) =>
      inkWidth("font-title", TEXT_STYLE, plainMarks(line).toUpperCase());
    const header = modalTitleLayout(
      { font: fontFileMetrics("font-title"), widthOf },
      barTitleRoom(bar, close),
      title,
    );
    header.lines.forEach((line) => {
      const width = widthOf(line);
      expectPlaced(bar, close, width);
      if (close.titleExclusion === "hit") {
        expect(
          Math.abs(2 * barTitleLeft(bar, close, width) + width - (2 * card.x + card.width)),
        ).toBeLessThanOrEqual(1);
      }
    });
  });
});
