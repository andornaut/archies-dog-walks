import type { Point } from "@andornaut/game-kit/runtime/rect";
import { inkWidth } from "@andornaut/game-kit/runtime/text/bitmapFont";

import { SLICES } from "../../data/index.ts";
import {
  backedTextPlaces,
  bindPanelFeedback,
  createGameButton,
  createTextLine,
  type DomPart,
  gridFillPart,
  imageArt,
  imageNineSlice,
  inkEnd,
  placeBackedText,
  placeBox,
  placeText,
  sheetArt,
  shownText,
} from "../../ui/dom/index.ts";
import { fontPixel, gridX, PALETTE, type PanelText, TEXT_SCALE } from "../../ui/index.ts";
import { createSelectionTile } from "./selectionTile.ts";
import type { ShopScreenInput, ShopScreenRow, ShopScreenView } from "./shopScreen.ts";

const ORIGIN = { x: 0, y: 0 };

// The Shop's authored heading, row and notice parts; the screen owns retention and readiness.
export function createShopScreenParts(doc: Document, input: ShopScreenInput) {
  const textPart = (line: PanelText, origin: Point = ORIGIN): DomPart => {
    const element = createTextLine(doc, line);
    return { element, place: (at) => placeText(input.fonts[line.font], at, origin, element, line) };
  };
  const headingPart = ({ band, note, title }: ShopScreenView["headings"][number]): DomPart => {
    const element = doc.createElement("div");
    element.className = "adw-lines";
    const labels = (["title", "body"] as const).map((font) => {
      const bitmap = input.fonts[font];
      const text = font === "title" ? title : note;
      const line = {
        capTop: band.y,
        centre: "left",
        centreX: band.x,
        colour: PALETTE.darkBrown,
        font,
        scale: TEXT_SCALE,
        text,
      } as const;
      const span = createTextLine(doc, line);
      element.append(span);
      const shown = shownText(font, text);
      const end = inkEnd(bitmap, shown);
      return { bitmap, end, line, span, start: end - inkWidth(bitmap, 1, shown) };
    });
    return {
      element,
      place: (at) => {
        const left = gridX(at, band.x);
        const right = gridX(at, band.x + band.width);
        const pixel = fontPixel(at, TEXT_SCALE);
        for (const { bitmap, end, line, span, start } of labels) {
          const place = backedTextPlaces(bitmap, at, ORIGIN, band, [line], "layout")[0]!;
          Object.assign(span.style, {
            fontSize: `${place.fontSize}px`,
            left: `${line.font === "title" ? left - start * pixel : right - end * pixel}px`,
            lineHeight: `${place.lineHeight}px`,
            top: `${place.top}px`,
          });
        }
      },
    };
  };
  const rowPart = (accepts: () => boolean, row: ShopScreenRow) => {
    const ready: Promise<readonly string[]>[] = [];
    const control = createGameButton(doc, {
      content: { kind: "icon", name: row.label },
      getAction: () =>
        accepts()
          ? {
              activate: () => input.activateRow(row.id),
              ...(row.holdDetail === true ? { hold: () => input.detailRow(row.id) } : {}),
            }
          : null,
      getState: () => ({ toggled: row.state === "selected" }),
      skin: "authored",
    });
    const stopFeedback = bindPanelFeedback(control, { accepts, burst: () => undefined });
    const tile = createSelectionTile(doc, input.source, input.fonts.title, {
      control,
      focus: "face",
      hit: row.rect,
      mark: "none",
      rect: row.rect,
      state: row.state,
    });
    const parts: DomPart[] = row.fills.map((fill) => gridFillPart(doc, row.rect, fill));
    // A row the bank does not cover keeps its greyed text on the focus fill and turns ink, as
    // any row's does, on the press fill.
    parts.push(
      ...row.texts.map((line) => {
        const part = textPart(line, row.rect);
        part.element.classList.add(
          row.selectable ? "adw-selection-focus-ink" : "adw-selection-press-ink",
        );
        return part;
      }),
    );
    for (const art of row.art) {
      const place = {
        ...art.rect,
        ...(art.projection === undefined ? {} : { projection: art.projection }),
      };
      if (art.sheet) {
        const part = sheetArt(doc, input.source, art.key, art.imageKey);
        parts.push({
          element: part.element,
          place: (at) =>
            part.place(at, row.rect, {
              ...place,
              ...(art.tag === undefined ? {} : { tag: art.tag }),
            }),
        });
        ready.push(part.ready);
      } else {
        const part = imageArt(doc, input.source, art.key, art.imageKey ?? art.key);
        parts.push({ element: part.element, place: (at) => part.place(at, row.rect, place) });
        ready.push(part.ready);
      }
    }
    // The price plate's fills and price are marked for the forced-colours plate.
    if (row.plate !== undefined) {
      const plate = row.plate;
      for (const fill of plate.fills) {
        const element = doc.createElement("span");
        element.className = "adw-framed adw-selection-plate";
        element.style.backgroundColor = `#${fill.colour.toString(16).padStart(6, "0")}`;
        parts.push({ element, place: (at) => placeBox(at, row.rect, element, fill.rect) });
      }
      const element = createTextLine(doc, plate.label);
      element.classList.add("adw-selection-plate-ink");
      parts.push({
        element,
        place: (at) =>
          placeBackedText(input.fonts.body, at, row.rect, plate.rect, [
            { element, line: plate.label },
          ]),
      });
    }
    tile.content.append(...parts.map(({ element }) => element));
    ready.push(tile.ready);
    return {
      dispose: () => {
        stopFeedback();
        control.dispose();
      },
      parts,
      ready,
      tile,
    };
  };
  const messageParts = (messageView: NonNullable<ShopScreenView["message"]>) => {
    const parts: DomPart[] = [];
    // ui-hint is a flat image, so the plate reads no sheet.
    const plate = imageNineSlice(
      doc,
      input.source,
      "ui-hint",
      input.source.imageSize("ui-hint"),
      SLICES["ui-hint"],
    );
    const content = doc.createElement("div");
    content.className = "adw-lines";
    const labels = messageView.lines.map((line) => ({
      element: createTextLine(doc, line),
      line,
    }));
    content.append(...labels.map(({ element }) => element));
    parts.push(
      {
        element: plate.element,
        place: (at) => plate.place(at, ORIGIN, messageView.rect),
      },
      {
        element: content,
        place: (at) => placeBackedText(input.fonts.body, at, ORIGIN, messageView.rect, labels),
      },
    );
    return { parts, ready: plate.ready };
  };
  return { headingPart, messageParts, rowPart };
}
