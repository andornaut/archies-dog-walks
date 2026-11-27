import type { Rect } from "@andornaut/game-kit/runtime/rect";

import { MENU_TEXT } from "../data/menuText.ts";
import {
  pageBack,
  PALETTE,
  type PanelButton,
  type PanelMeasure,
  type PanelText,
  panelTitle,
  raisedLabelCapTop,
  TEXT_SCALE,
  titleLabelInk,
} from "../ui/index.ts";
import { SHOP_LAYOUT, shopTabFace, shopTabRects } from "./shopLayout.ts";

// The native Pet shop and Logbook share this frameless page view beneath the home top bar, which
// the page template (src/home/dom/page.ts) draws.
// Every rectangle and text origin is in logical game pixels.

// A rect filled in one colour.
export interface PageFill {
  readonly colour: number;
  readonly rect: Rect;
}

// A tab's fixed face and label, and whether it is the open tab.
export interface PageTab {
  readonly face: Rect;
  readonly label: PanelText;
  readonly selected: boolean;
}

export interface ShopPageView {
  // The primary Back button, the page's only leave.
  readonly back: PanelButton;
  // The cream page from the top bar down to the screen's edges, so the bar shows above it.
  readonly fill: PageFill;
  readonly panel: Rect;
  readonly tabs: readonly PageTab[];
  // Shared heading lines centred across the page.
  readonly title: readonly PanelText[];
}

// A tab on the page: its label and whether it is open.
export interface ShopPageTab {
  readonly label: string;
  readonly open: boolean;
}

const PANEL = SHOP_LAYOUT.panel;

// A tab's label ink is centred on its standard face.
function pageTab(measure: PanelMeasure, face: Rect, tab: ShopPageTab): PageTab {
  return {
    face,
    label: {
      capTop: raisedLabelCapTop(face, titleLabelInk(measure, [tab.label])),
      centre: "ink",
      centreX: face.x + face.width / 2,
      colour: PALETTE.plum,
      font: "title",
      line: 0,
      scale: TEXT_SCALE,
      text: tab.label,
    },
    selected: tab.open,
  };
}

// The page titled title, its tabs left to right across the tab span (shopTabRects), and Back.
export function shopPageView(
  measure: PanelMeasure,
  page: { tabs: readonly ShopPageTab[]; title: string },
): ShopPageView {
  const { title } = SHOP_LAYOUT;
  const tabs = shopTabRects(page.tabs.length).flatMap((hit, i) => {
    const tab = page.tabs[i];
    return tab === undefined ? [] : [pageTab(measure, shopTabFace(hit), tab)];
  });
  return {
    back: pageBack(measure, MENU_TEXT.pageBack),
    fill: { colour: PALETTE.cream, rect: PANEL },
    panel: PANEL,
    tabs,
    title: panelTitle(measure, PANEL, title.capTop, page.title, false),
  };
}
