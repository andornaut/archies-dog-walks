import { insetRect, type Rect } from "@andornaut/game-kit/runtime/rect";

import { SELECT_OUTSET } from "../data/index.ts";
import { MENU_TEXT } from "../data/menuText.ts";
import {
  GREYED,
  pageBack,
  PALETTE,
  type PanelButton,
  type PanelMeasure,
  type PanelText,
  panelTitle,
  PLAIN_ITEM,
  raisedLabelCapTop,
  selectLook,
  TEXT_SCALE,
  tileState,
  titleLabelInk,
} from "../ui/index.ts";
import { FEEDBACK } from "./feedback.ts";
import { SHOP_LAYOUT, shopTabFace, shopTabRects } from "./shopLayout.ts";

// The native Pet shop and Logbook share this frameless page view beneath the home top bar, which
// the page template (src/home/dom/page.ts) draws.
// Every rectangle and text origin is in logical game pixels.

// A rect filled in one colour.
export interface PageFill {
  readonly colour: number;
  readonly rect: Rect;
}

// A tab: the open tab's plum shadow, which stays put, then its face (a border round a fill, a
// pixel wide) and its label, which move together dy pixels (the open tab's lift, a pressed tab's
// dip) from where they are laid out.
export interface PageTab {
  readonly border: number;
  readonly dy: number;
  readonly face: Rect;
  readonly fill: number;
  readonly framed: boolean;
  readonly label: PanelText;
  readonly shadow: Rect | undefined;
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

// A tab on the page: its label, and whether it is the open one or pressed.
export interface ShopPageTab {
  readonly label: string;
  readonly open: boolean;
  readonly pressed: boolean;
}

const PANEL = SHOP_LAYOUT.panel;

// A tab on face: its face drawn in code with a slate edge; selected while open, its edge ink and
// lifted onto a plum shadow; a pressed one dipped; its label's ink centred on its raised face.
function pageTab(measure: PanelMeasure, face: Rect, tab: ShopPageTab): PageTab {
  const look = selectLook(tileState({ ...PLAIN_ITEM, picked: tab.open }));
  const selected = look.state === "selected";
  const fill = PALETTE[look.face];
  const border = selected ? PALETTE.ink : PALETTE[GREYED.edge];
  const outer = selected ? insetRect(-SELECT_OUTSET, face) : face;
  return {
    border,
    dy: (selected ? -FEEDBACK.liftPx : 0) + (tab.pressed ? FEEDBACK.pressDipPx : 0),
    face,
    fill,
    framed: selected,
    label: {
      capTop: raisedLabelCapTop(face, titleLabelInk(measure, [tab.label])),
      centre: "ink",
      centreX: face.x + face.width / 2,
      colour: PALETTE[look.text],
      font: "title",
      line: 0,
      scale: TEXT_SCALE,
      text: tab.label,
    },
    shadow: selected
      ? {
          height: FEEDBACK.liftPx,
          width: outer.width - 2,
          x: outer.x + 2,
          y: outer.y + outer.height - FEEDBACK.liftPx,
        }
      : undefined,
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
