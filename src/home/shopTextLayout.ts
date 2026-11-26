import { wrapWords } from "@andornaut/game-kit/runtime/lines";
import type { Rect } from "@andornaut/game-kit/runtime/rect";
import { advanceWidth, type BitmapFont } from "@andornaut/game-kit/runtime/text/bitmapFont";

import { gameData, PLATE_PAD } from "../data/index.ts";
import { dollarText } from "../presentation/index.ts";
import type { SaveDocument } from "../save/index.ts";
import { type PanelMeasure, stackRows, TEXT_SCALE } from "../ui/index.ts";
import { dogRows, gearRows, ownedCountNote, type ShopRow, type ShopTab, slotRows } from "./shop.ts";
import {
  SHOP_LAYOUT,
  SHOP_MESSAGE_FIT,
  shopListFrame,
  shopMessageLayout,
  shopNextHeading,
  shopRowsBottom,
  shopRowTextLayout,
  shopRowTextRoom,
} from "./shopLayout.ts";

const LAYOUT = SHOP_LAYOUT;
const OWNED_DX = LAYOUT.row.ownedDx;

// A row as laid out on the open tab.
export interface ShopPlacedRow {
  readonly rect: Rect;
  readonly row: ShopRow;
}

// Text is measured once into the same rows used by native painting, scrolling and contacts.
export type ShopFonts = Readonly<Record<"body" | "title", BitmapFont>>;
export type ShopShownText = (font: "body" | "title", text: string) => string;

export function shopTextLayout(
  fonts: ShopFonts,
  shownText: ShopShownText,
  measure: Pick<PanelMeasure, "body">,
  subject: { readonly message: string | null; readonly save: SaveDocument; readonly tab: ShopTab },
) {
  const widthOf = (text: string) => advanceWidth(fonts.body, TEXT_SCALE, shownText("body", text));
  const lines =
    subject.message === null ? [] : wrapWords(widthOf, SHOP_MESSAGE_FIT.room, subject.message);
  const message = shopMessageLayout(measure.body, Math.max(1, lines.length));
  const build = (frame: ReturnType<typeof shopListFrame>) => {
    const headings: { readonly note: string; readonly text: string; readonly y: number }[] = [];
    const placed: (ShopPlacedRow & {
      readonly lines: readonly string[];
      readonly text: ReturnType<typeof shopRowTextLayout>;
    })[] = [];
    const add = (
      spec: { readonly gap: number; readonly height: number; readonly y: number },
      rows: readonly ShopRow[],
    ) => {
      const described = rows.map((row) => {
        const right =
          row.price === null
            ? OWNED_DX +
              advanceWidth(fonts.title, TEXT_SCALE, gameData.homeText.shop.owned.toUpperCase())
            : widthOf(dollarText(row.price)) + 2 * PLATE_PAD;
        const room = shopRowTextRoom(frame.rowWidth, right);
        const lines = row.line === "" ? [] : wrapWords(widthOf, room, row.line);
        return {
          lines,
          text: shopRowTextLayout(fonts.body, spec.height, { descriptions: lines, name: row.name }),
        };
      });
      const rects = stackRows(
        { ...spec, width: frame.rowWidth, x: SHOP_LAYOUT.row.x },
        described.map(({ text }) => text.height),
      );
      rows.forEach((row, index) => placed.push({ ...described[index]!, rect: rects[index]!, row }));
      return rects;
    };
    const words = gameData.homeText.shop;
    const shift = message.extraHeight;
    let bottom: number;
    if (subject.tab === "gear") {
      const spec = { ...LAYOUT.gear.rows, y: LAYOUT.gear.rows.y + shift };
      headings.push({
        note: ownedCountNote(gameData, subject.save.owned, "gear"),
        text: words.tabs.gear,
        y: LAYOUT.gear.headingY + shift,
      });
      bottom = shopRowsBottom(spec, add(spec, gearRows(gameData, subject.save.owned)));
    } else {
      const slots = { ...LAYOUT.dogs.slotRows, y: LAYOUT.dogs.slotRows.y + shift };
      headings.push({
        note: ownedCountNote(gameData, subject.save.owned, "slots"),
        text: words.slots,
        y: LAYOUT.dogs.slotHeadingY + shift,
      });
      const slotRects = add(slots, slotRows(gameData, subject.save.owned));
      const heading = shopNextHeading(slots, slotRects);
      headings.push({
        note: ownedCountNote(gameData, subject.save.owned, "dogs"),
        text: words.dogs,
        y: heading,
      });
      const dogs = {
        ...LAYOUT.dogs.dogRows,
        y: heading + LAYOUT.dogs.dogRows.y - LAYOUT.dogs.dogHeadingY,
      };
      bottom = shopRowsBottom(dogs, add(dogs, dogRows(gameData, subject.save.owned)));
    }
    return { bottom: bottom + LAYOUT.list.padBottom, frame, headings, rows: placed };
  };
  const layout = build(shopListFrame());
  return { ...layout, message: { ...message, lines } };
}
