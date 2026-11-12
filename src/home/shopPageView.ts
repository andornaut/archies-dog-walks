import { insetRect, type Rect } from "@andornaut/game-kit/rect";

import { SCREEN_CONFIG } from "../data/screen.ts";
import type { PanelMeasure, PanelText } from "../hud/questionPanelView.ts";
import { barTitleLeft } from "../ui/barTitle.ts";
import type { CloseControl } from "../ui/closeControl.ts";
import { PLAIN_ITEM, tileState } from "../ui/interaction.ts";
import { PALETTE } from "../ui/palette.ts";
import { GREYED, SELECT_OUTSET, selectLook } from "../ui/selection.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";
import { FEEDBACK } from "./feedback.ts";
import { SHOP_LAYOUT, shopTabFace, shopTabRects } from "./shopLayout.ts";

// The page the Pet shop and the Logbook share, under the home screen's top bar, laid out as one
// view both renderers draw: the canvas's (addShopPage and addShopTabs in src/scenes/shopPage.ts)
// and the HTML interface's (src/hud/dom/shopPage.ts). Every rect and text origin is in game
// pixels.

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
  readonly card: Rect;
  readonly close: CloseControl;
  readonly closePressed: boolean;
  readonly tabs: readonly PageTab[];
  // Its one line in plum, its ink centred where the header centres it beside the close control,
  // so the HTML's narrower text stays centred there.
  readonly title: PanelText;
  // The wood under the card, from the top bar down, so the home screen's bar shows above it.
  readonly wood: PageFill;
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

// The page titled title, its close control shown pressed while closePressed, and its tabs left
// to right across the tab span (shopTabRects).
export function shopPageView(
  measure: PanelMeasure,
  page: { closePressed: boolean; tabs: readonly ShopPageTab[]; title: string },
): ShopPageView {
  const { close, title } = SHOP_LAYOUT;
  const ink = measure.inkWidth("title", page.title);
  const left = barTitleLeft(title.row, close, ink);
  const tabs = shopTabRects(page.tabs.length).flatMap((hit, i) => {
    const tab = page.tabs[i];
    return tab === undefined ? [] : [pageTab(measure, shopTabFace(hit), tab)];
  });
  return {
    card: PANEL,
    close,
    closePressed: page.closePressed,
    tabs,
    title: {
      capTop: title.capTop,
      centre: "ink",
      centreX: left + ink / 2,
      colour: PALETTE.plum,
      font: "title",
      line: 0,
      scale: TEXT_SCALE,
      text: page.title,
    },
    wood: {
      colour: PALETTE.darkBrown,
      rect: {
        height: SCREEN_CONFIG.height - PANEL.y + 4,
        width: SCREEN_CONFIG.width,
        x: 0,
        y: PANEL.y - 4,
      },
    },
  };
}
