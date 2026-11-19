import { expect, it } from "vitest";

import { HELP_LAYOUT } from "../help/helpLayout.ts";
import { PAGE_LAYOUT } from "../ui/pageLayout.ts";
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
  ["the list beside a scrollbar", list.rect, { height: 348, width: 342, x: 0, y: 144 }],
  ["the list without one", list.unscrolledRect, { height: 348, width: 360, x: 0, y: 144 }],
  ["the rows", [row.x, row.width, row.scrollWidth], [8, 344, 330]],
  ["the scroll track", [SHOP_LAYOUT.scrollbar.x, SHOP_LAYOUT.scrollbar.trackWidth], [344, 8]],
  ["the Logbook's columns", [STATS_LAYOUT.rows.left, STATS_LAYOUT.rows.right], [8, 338]],
  ["Back", PAGE_LAYOUT.back, BACK],
  ["the Pet shop's and Logbook's Back", SHOP_LAYOUT.back, BACK],
  ["Help's Back", HELP_LAYOUT.footer, BACK],
])("places %s", (_name, actual, expected) => {
  expect(actual).toEqual(expected);
});
