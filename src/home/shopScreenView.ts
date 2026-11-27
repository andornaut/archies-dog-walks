import { insetRect } from "@andornaut/game-kit/runtime/rect";
import { advanceWidth } from "@andornaut/game-kit/runtime/text/bitmapFont";

import { CHECK_SIZE, gameData, PLATE_PAD } from "../data/index.ts";
import { dollarText } from "../presentation/index.ts";
import type { SaveDocument } from "../save/index.ts";
import {
  type Badge,
  disabledArtKey,
  GREYED,
  PALETTE,
  type PanelMeasure,
  type PanelText,
  pictureBox,
  selectLook,
  TEXT_SCALE,
} from "../ui/index.ts";
import type { Purchase } from "./home.ts";
import { pricePlateView } from "./pricePlateView.ts";
import { SHOP_ROW_VIEWS, SHOP_TABS, shopRowLook, type ShopTab } from "./shop.ts";
import { SHOP_LAYOUT, shopHeadingBand, shopRowTextLayout } from "./shopLayout.ts";
import { shopPageView } from "./shopPageView.ts";
import { type ShopFonts, type ShopShownText, shopTextLayout } from "./shopTextLayout.ts";

const ROW = SHOP_LAYOUT.row;
const OWNED_DX = ROW.ownedDx;

// The layouts feeding native painting, hit testing and the scroll viewport share the same rows.
export function shopScreenView(
  ports: {
    readonly art: {
      readonly badge: (badge: Badge) => {
        readonly height: number;
        readonly key: string;
        readonly width: number;
      };
      readonly frame: "art" | "fallback";
      readonly pictureKey: (purchase: Purchase) => string;
    };
    readonly fonts: ShopFonts;
    readonly measure: PanelMeasure;
    readonly shownText: ShopShownText;
  },
  subject: {
    readonly focusId: string | null;
    readonly message: { readonly refused: boolean; readonly text: string } | null;
    readonly save: SaveDocument;
    readonly tab: ShopTab;
  },
) {
  const { art, fonts, measure, shownText } = ports;
  const layout = shopTextLayout(fonts, shownText, measure, {
    message: subject.message?.text ?? null,
    save: subject.save,
    tab: subject.tab,
  });
  const line = (
    text: string,
    x: number,
    capTop: number,
    colour: number,
    font: "body" | "title" = "body",
  ): PanelText => ({
    capTop,
    centre: "left",
    centreX: x,
    colour,
    font,
    line: 0,
    scale: TEXT_SCALE,
    text,
  });
  let { focusId } = subject;
  const rows = layout.rows.map(({ lines: descriptions, rect, row, text }) => {
    const rowLook = shopRowLook(gameData, subject.save.owned, subject.save.bankCents, row);
    const selectable = rowLook !== "short";
    if (!selectable && focusId === row.id) {
      focusId = null;
    }
    const look = SHOP_ROW_VIEWS[rowLook];
    const mid = rect.y + Math.floor(rect.height / 2);
    const right = rect.x + rect.width - ROW.plateInset;
    const box = {
      height: ROW.box.size,
      width: ROW.box.size,
      x: rect.x + ROW.box.dx,
      y: rect.y + Math.floor((rect.height - ROW.box.size) / 2),
    };
    const key = art.pictureKey(row.purchase);
    const texts = [
      line(row.name, rect.x + ROW.textDx, rect.y + text.name, PALETTE[selectLook(look.state).text]),
    ];
    descriptions.forEach((description, index) => {
      texts.push(
        line(
          description,
          rect.x + ROW.textDx,
          rect.y + text.descriptions[index]!,
          look.state === "disabled" ? PALETTE[GREYED.text] : PALETTE.darkBrown,
        ),
      );
    });
    const badge = look.badge === null ? undefined : art.badge(look.badge);
    const pictures = [
      {
        key,
        projection: "layout" as const,
        rect: insetRect(ROW.art, box),
        sheet: row.purchase.kind === "dog",
        ...(look.art === "grey" ? { imageKey: disabledArtKey(key) } : {}),
        tag: "happy",
      },
      ...(badge === undefined
        ? []
        : [
            {
              key: badge.key,
              rect: {
                height: badge.height,
                width: badge.width,
                x: rect.x + ROW.badge.dx,
                y: rect.y + ROW.badge.dy,
              },
              sheet: false,
            },
          ]),
    ];
    const ownedRow = row.price === null || look.plate === null;
    if (ownedRow) {
      const owned = gameData.homeText.shop.owned;
      const ownedTop = shopRowTextLayout(fonts.title, rect.height, {
        descriptions: [],
        name: shownText("title", owned),
      }).name;
      texts.push(
        line(
          owned,
          right - OWNED_DX - advanceWidth(fonts.title, TEXT_SCALE, owned.toUpperCase()),
          rect.y + ownedTop,
          PALETTE.forest,
          "title",
        ),
      );
    }
    const plate = ownedRow
      ? undefined
      : pricePlateView(
          {
            capHeight: measure.body.capHeight,
            padding: PLATE_PAD,
            scale: TEXT_SCALE,
            width: (value) => advanceWidth(fonts.body, TEXT_SCALE, value),
          },
          { capTop: mid - (measure.body.capHeight * TEXT_SCALE) / 2, originX: 1, x: right },
          look.plate,
          dollarText(row.price),
        );
    return {
      art: ownedRow
        ? [
            ...pictures,
            {
              key: "ui-check",
              rect: {
                height: CHECK_SIZE,
                width: CHECK_SIZE,
                x: right - CHECK_SIZE,
                y: mid - CHECK_SIZE / 2,
              },
              sheet: true,
              tag: "tick",
            },
          ]
        : pictures,
      fills: [{ colour: PALETTE[pictureBox(look)], rect: box }],
      frame: art.frame,
      holdDetail: true,
      id: row.id,
      label: row.name,
      rect,
      selectable,
      state: look.state,
      texts,
      ...(plate === undefined ? {} : { plate }),
    };
  });
  const { message } = subject;
  const words = gameData.homeText.shop;
  const view = {
    clip: layout.frame.rect,
    headings: layout.headings.map(({ note, text, y }) => ({
      band: shopHeadingBand(y),
      note,
      title: text,
    })),
    page: shopPageView(measure, {
      tabs: SHOP_TABS.map((tab) => ({
        label: words.tabs[tab],
        open: tab === subject.tab,
      })),
      title: words.title,
    }),
    rows,
    ...(message === null
      ? {}
      : {
          message: {
            lines: layout.message.lines.map((text, index) => ({
              ...line(
                text,
                layout.message.plate.x + layout.message.plate.width / 2,
                layout.message.capTops[index]!,
                message.refused ? PALETTE.darkRed : PALETTE.forest,
              ),
              centre: "ink" as const,
            })),
            rect: layout.message.plate,
          },
        }),
  };
  return { focusId, layout, view };
}
