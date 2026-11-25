import { describe, expect, it } from "vitest";

import { HELP_LAYOUT } from "../help/helpLayout.ts";
import { PAGE_LAYOUT, stackRows } from "../ui/pageLayout.ts";
import { SHOP_LAYOUT } from "./shopLayout.ts";
import { STATS_LAYOUT } from "./statsLayout.ts";

// Art's frameless page table (art/layout.md): the Pet shop and Logbook page edge to edge under the
// top bar, and Back at one place on all three pages.
const BACK = { height: 48, width: 128, x: 116, y: 500 };
const { list, row, tab } = SHOP_LAYOUT;

it.each([
  ["the page", SHOP_LAYOUT.panel, { height: 520, width: 360, x: 0, y: 40 }],
  ["the Logbook's page", STATS_LAYOUT.panel, SHOP_LAYOUT.panel],
  ["the heading's capitals' top", SHOP_LAYOUT.title.capTop, 64],
  ["the tabs", [tab.x, tab.span, tab.y, tab.height, tab.drawY], [8, 344, 95, 48, 105]],
  ["the list", list.rect, { height: 348, width: 342, x: 0, y: 144 }],
  ["the rows and tabs", [row.x, row.width, tab.span], [8, 330, 344]],
  ["the scroll track", [PAGE_LAYOUT.scrollbar.x, PAGE_LAYOUT.scrollbar.trackWidth], [344, 8]],
  ["the Logbook's columns", [STATS_LAYOUT.rows.left, STATS_LAYOUT.rows.right], [8, 338]],
  ["Back", PAGE_LAYOUT.back, BACK],
  ["the Pet shop's and Logbook's Back", SHOP_LAYOUT.back, BACK],
  ["Help's Back", HELP_LAYOUT.footer, BACK],
])("places %s", (_name, actual, expected) => {
  expect(actual).toEqual(expected);
});

describe("stackRows", () => {
  // Each row as tall as its height, gap under the one before; the tap targets are the rows.
  const spec = { gap: 8, width: 316, x: 16, y: 138 };
  it.each<[string, number[], number[]]>([
    ["one row", [36], [138]],
    ["rows of mixed heights", [36, 56, 40], [138, 182, 246]],
  ])("lays out %s gap apart from the top", (_, heights, tops) => {
    const rects = stackRows(spec, heights);
    expect(rects).toEqual(
      heights.map((height, i) => ({ height, width: spec.width, x: spec.x, y: tops[i] })),
    );
  });
});
