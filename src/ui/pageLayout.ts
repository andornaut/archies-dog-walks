import type { Rect } from "@andornaut/game-kit/runtime/rect";
import { arrangeActions } from "@andornaut/game-kit/runtime/ui/actionGroup";
import {
  type ModalFrameContext,
  type ModalTitleSize,
  modalFrameRooms,
  placeModalFrame,
} from "@andornaut/game-kit/runtime/ui/modalFrame";

import { PAGE, ROWS_PAGE, SCREEN_CONFIG, SHOP_PAGE, TOP_BAR_HEIGHT } from "../data/index.ts";
import { BUTTON_SIZE } from "./buttonGeometry.ts";
import { modalActionWidth } from "./modal/layout.ts";
import type { PanelButton, PanelMeasure } from "./modal/types.ts";
import { panelButton } from "./modal/view.ts";
import { MODAL } from "./modalGeometry.ts";

const { height, width } = SCREEN_CONFIG;
const RECT = { height: height - TOP_BAR_HEIGHT, width, x: 0, y: TOP_BAR_HEIGHT } as const;

// The pages' frame, the kit's page variant (placeModalFrame): the screen under the top bar, a
// card's title row, and Back's room inset columns in from each side and backFoot rows over the
// screen's foot. Each page places and scrolls its own list, so the frame's body holds no content
// height of its own.
export const PAGE_FRAME: {
  readonly context: ModalFrameContext;
  readonly footer: number;
  readonly title: ModalTitleSize;
} = {
  context: { content: RECT, insets: { bottom: PAGE.backFoot, side: PAGE.inset }, variant: "page" },
  footer: BUTTON_SIZE.compact.height,
  title: { height: MODAL.header - 2 * MODAL.titleTop, inset: MODAL.titleTop },
};
const FRAME = placeModalFrame(PAGE_FRAME.context, {
  body: 0,
  footer: PAGE_FRAME.footer,
  title: PAGE_FRAME.title,
});

// A titled page's title row.
export const PAGE_TITLE_ROW: Rect = FRAME.title;

// The pages' Back: a leave action, content-sized in the slot centred over the page's foot. A
// separate role from the end screen's Back to title (END_LAYOUT.backToTitle), its main next step.
const BACK = {
  ...BUTTON_SIZE.compact,
  x: (width - BUTTON_SIZE.compact.width) / 2,
  y: FRAME.footer!.y,
} as const;

// The Help, Logbook and Pet shop pages share this geometry. Each page fills the screen under the
// live top bar edge to edge, with no frame, border, margin or close control. Its content takes
// inset columns from each side, its scrollbar's track ends inset columns in from the screen's
// right edge, beside a list or body longer than its view, and the primary Back button, its only
// leave, is centred backFoot rows over the screen's foot.
export const PAGE_LAYOUT = {
  back: BACK,
  inset: PAGE.inset,
  rect: RECT,
  scrollbar: { ...SHOP_PAGE.scrollbar, x: width - PAGE.inset - SHOP_PAGE.scrollbar.trackWidth },
} as const;

// The Settings and Cheats pages: their rows' column, from the page's inset to PAGE.trackGap short
// of the scrollbar's track, whether or not the rows scroll; the body's top, titleGap rows under the
// title row; and the rows' foot over what stays fixed under the body (bodyFoot) and the version
// label's lowest ink over Back's face (labelFoot).
export const ROWS_PAGE_LAYOUT = {
  bodyFoot: ROWS_PAGE.bodyFoot,
  bodyTop: PAGE_TITLE_ROW.y + PAGE_TITLE_ROW.height + ROWS_PAGE.titleGap,
  column: {
    width: PAGE_LAYOUT.scrollbar.x - PAGE.trackGap - PAGE.inset,
    x: PAGE.inset,
  },
  labelInkBottom: BACK.y - ROWS_PAGE.labelFoot,
} as const;

// A page's Back: its label's button centred across the page in the Back slot.
export function pageBack(
  measure: Pick<PanelMeasure, "inkWidth" | "title" | "titleInk">,
  label: string,
): PanelButton {
  const [back] = arrangeActions(
    {
      origin: FRAME.footer!,
      press: { margin: 0 },
      variant: "footer",
      width: modalFrameRooms(PAGE_FRAME.context).footer,
    },
    [
      {
        key: 0,
        role: "primary",
        size: { height: BACK.height, width: modalActionWidth(measure.inkWidth("title", label)) },
      },
    ],
  ).actions;
  if (back === undefined || back.hidden) throw new Error("Page Back action must be visible");
  return { ...panelButton(measure, back.face, true, label), actionIndex: 0 };
}

// A page's rows from spec.y down, one per height, spec.width wide from spec.x and spec.gap apart.
export function stackRows(
  spec: { readonly gap: number; readonly width: number; readonly x: number; readonly y: number },
  heights: readonly number[],
): Rect[] {
  let y = spec.y;
  return heights.map((height) => {
    const rect = { height, width: spec.width, x: spec.x, y };
    y += height + spec.gap;
    return rect;
  });
}
