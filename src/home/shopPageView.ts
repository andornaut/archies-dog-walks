import { insetRect, type Rect } from "@andornaut/game-kit/runtime/rect";

import { MENU_TEXT } from "../data/menuText.ts";
import { PLAIN_ITEM, tileState } from "../ui/interaction.ts";
import { modalActionWidth } from "../ui/modal/layout.ts";
import { type PanelButton, type PanelMeasure, type PanelText } from "../ui/modal/types.ts";
import { panelButton, panelTitle } from "../ui/modal/view.ts";
import { PALETTE } from "../ui/palette.ts";
import { GREYED, SELECT_OUTSET, selectLook } from "../ui/selection.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";
import { FEEDBACK } from "./feedback.ts";
import { SHOP_LAYOUT, shopTabFace, shopTabRects } from "./shopLayout.ts";

// The native Pet shop and Logbook share this frameless page view beneath the home top bar.
// Every rectangle and text origin is in logical game pixels.

// A rect filled in one colour.
export interface PageFill {
  readonly colour: number;
  readonly rect: Rect;
}

// A tab: its plum shadow, which stays put, then its face (a border round a fill, a pixel wide),
// the open tab's static gold frame SELECT_OUTSET pixels outside it (SELECT_FRAME) and its label,
// which move together dy pixels (the open tab's lift, a pressed tab's dip) from where they are
// laid out.
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

// The open tab's static gold frame round outer, as the canvas draws it (addSelectFrame): an ink
// ring a pixel wide less its corners, an amber band two wide inside it, an ink keyline a pixel
// wide three in, and an ink dot in each corner a pixel in. Each is inset pixels in from outer.
export const SELECT_FRAME = {
  amber: { inset: 1, width: 2 },
  dots: { inset: 1 },
  keyline: { inset: 3, width: 1 },
  ring: { inset: 0, width: 1 },
} as const;

// A tab on face: selected while open, its face drawn in code with a slate edge, lifted onto a plum
// shadow with the gold frame; a pressed one dipped; its label centred in the title font.
function pageTab(measure: PanelMeasure, face: Rect, tab: ShopPageTab): PageTab {
  const look = selectLook(tileState({ ...PLAIN_ITEM, picked: tab.open }));
  const selected = look.state === "selected";
  const fill = PALETTE[look.face];
  const border = selected ? PALETTE.ink : PALETTE[GREYED.edge];
  const outer = selected ? insetRect(-SELECT_OUTSET, face) : face;
  const { capTop, lineHeight } = measure.title;
  return {
    border,
    dy: (selected ? -FEEDBACK.liftPx : 0) + (tab.pressed ? FEEDBACK.pressDipPx : 0),
    face,
    fill,
    framed: selected,
    label: {
      // As a label with originY 0.5 on the face's middle, its line's capitals capTop rows in.
      capTop: Math.round(face.y + face.height / 2) + (capTop - lineHeight / 2) * TEXT_SCALE,
      centre: "advance",
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
  const { back, title } = SHOP_LAYOUT;
  const backWidth = modalActionWidth(measure.inkWidth("title", MENU_TEXT.pageBack));

  const tabs = shopTabRects(page.tabs.length).flatMap((hit, i) => {
    const tab = page.tabs[i];
    return tab === undefined ? [] : [pageTab(measure, shopTabFace(hit), tab)];
  });
  return {
    back: panelButton(
      measure,
      { ...back, width: backWidth, x: back.x + (back.width - backWidth) / 2 },
      true,
      MENU_TEXT.pageBack,
    ),
    fill: { colour: PALETTE.cream, rect: PANEL },
    panel: PANEL,
    tabs,
    title: panelTitle(measure, PANEL, title.capTop, page.title, false),
  };
}
