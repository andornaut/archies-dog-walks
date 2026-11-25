import { containsPoint, type Point, type Rect } from "@andornaut/game-kit/runtime/rect";
import { type BitmapFont, inkWidth } from "@andornaut/game-kit/runtime/text/bitmapFont";

import { SLICES } from "../../data/layout.ts";
import {
  createSelectionTile,
  type NativeSelectionTile,
  type NativeTileFill,
} from "../../home/dom/selectionTile.ts";
import { FEEDBACK } from "../../home/feedback.ts";
import { SHOP_LAYOUT, shopTabRects } from "../../home/shopLayout.ts";
import type { ShopPageView } from "../../home/shopPageView.ts";
import { isConfirmKey } from "../../input/keyBindings.ts";
import { type DomArtSource, imageArt, imageNineSlice, sheetArt } from "../../ui/dom/artElements.ts";
import { createGameButton } from "../../ui/dom/gameButton.ts";
import { type DomPart, gridFillPart } from "../../ui/dom/parts.ts";
import {
  backedTextPlaces,
  createTextLine,
  inkEnd,
  placeBackedText,
  placeBox,
  placeText,
  setBox,
  shownText,
} from "../../ui/dom/pixelLine.ts";
import type { UiLayer } from "../../ui/dom/uiLayer.ts";
import { fontPixel, gridRect, gridX } from "../../ui/domScale.ts";
import type { TileState } from "../../ui/interaction.ts";
import type { PanelText } from "../../ui/modal/types.ts";
import { PALETTE } from "../../ui/palette.ts";
import { TEXT_SCALE } from "../../ui/textFit.ts";
import { scrollPlace } from "./logbook.ts";
import { type DomPage, showPage } from "./page.ts";
import { bindPanelFeedback } from "./panelButton.ts";

export interface ShopScreenArt {
  readonly key: string;
  readonly imageKey?: string;
  readonly projection?: "layout";
  readonly rect: Rect;
  readonly sheet: boolean;
  readonly tag?: string;
}

export interface ShopScreenRow {
  readonly frame: "art" | "fallback";
  readonly holdDetail?: boolean;
  readonly id: string;
  readonly label: string;
  readonly rect: Rect;
  readonly selectable: boolean;
  readonly state: TileState;
  readonly fills: readonly NativeTileFill[];
  readonly texts: readonly PanelText[];
  readonly art: readonly ShopScreenArt[];
  readonly plate?: {
    readonly rect: Rect;
    readonly fills: readonly NativeTileFill[];
    readonly label: PanelText;
  };
}

export interface ShopScreenView {
  readonly page: ShopPageView;
  readonly clip: Rect;
  readonly headings: readonly {
    readonly band: Rect;
    readonly note: string;
    readonly title: string;
  }[];
  readonly rows: readonly ShopScreenRow[];
  readonly message?: { readonly rect: Rect; readonly lines: readonly PanelText[] };
}

export interface ShopScreenMotion {
  readonly pressed?: string;
  readonly scroll: { readonly max: number; readonly settled: boolean; readonly y: number };
  readonly rows: ReadonlyMap<
    string,
    {
      readonly x: number;
      readonly focused: boolean;
    }
  >;
}

export interface NativeShopScreen {
  readonly element: HTMLElement;
  accepts(): boolean;
  capture(): () => boolean;
  destroy(): void;
  focusRow(id: string): void;
  setDimmed(dimmed: boolean): void;
  setEnabled(enabled: boolean): void;
  setInert(inert: boolean): void;
  setShown(shown: boolean): void;
  update(view: ShopScreenView): void;
  place(motion: ShopScreenMotion): void;
}

export interface ShopScreenInput {
  // What Back does.
  readonly close: () => void;
  // imageSize is a flat image's native size, which the message plate's nine-slice needs.
  readonly source: DomArtSource & {
    readonly imageSize: (key: string) => { readonly height: number; readonly width: number };
  };
  readonly fonts: Readonly<Record<"body" | "title", BitmapFont>>;
  readonly toGame: (client: Point) => Point;
  readonly active: () => boolean;
  readonly cancel: () => void;
  readonly down: (point: Point) => void;
  readonly move: (point: Point) => void;
  readonly up: (point: Point, cancelled: boolean) => boolean | void;
  readonly activateRow: (id: string) => void;
  readonly detailRow: (id: string) => void;
  readonly wheel: (deltaY: number) => void;
  readonly key: (code: string, repeat: boolean) => void;
  readonly click: (point: Point) => void;
}

const ORIGIN = { x: 0, y: 0 };

// The scene owns purchases and gestures. This surface owns only native painting, on the page
// template (showPage), which it mounts again whenever the page's chrome changes or new art must
// load before the page shows.
export function showShopScreen(
  layer: UiLayer,
  input: ShopScreenInput,
  initial: ShopScreenView,
): NativeShopScreen {
  const doc = layer.element.ownerDocument;
  const clip = doc.createElement("div");
  clip.className = "adw-clip";
  clip.style.pointerEvents = "auto";
  const scrolled = doc.createElement("div");
  scrolled.className = "adw-scrolled";
  const headings = doc.createElement("div");
  headings.className = "adw-lines";
  scrolled.append(headings);
  clip.append(scrolled);
  const message = doc.createElement("div");
  message.className = "adw-lines";
  let alive = true,
    shown = true,
    enabled = true,
    inert = false,
    dimmed = false;
  let view = initial;
  let tabGesture: Rect | undefined;
  let rowGesture: string | undefined;
  let scale = layer.scale();
  let motion: ShopScreenMotion | undefined;
  let page: DomPage | undefined;
  let headingParts: DomPart[] = [],
    messageParts: DomPart[] = [];
  const rows = new Map<
    string,
    { dispose(): void; key: string; tile: NativeSelectionTile; parts: DomPart[] }
  >();
  let chromeKey = "",
    headingsKey = "",
    messageKey = "";
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
        const panel = gridRect(at, SHOP_LAYOUT.panel);
        const right = gridX(at, band.x + band.width);
        const left = 2 * panel.left + panel.width - right;
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
  const accepts = () => alive && input.active() && page?.accepts() === true;
  const capture = () => {
    const admitted = accepts();
    const check = page?.capture() ?? (() => false);
    return () => admitted && check() && accepts();
  };
  // The headings and rows at the list's scroll.
  const placeList = () => {
    setBox(clip, gridRect(scale, view.clip));
    const scrolling = scrollPlace(scale, motion?.scroll ?? { settled: true, y: 0 });
    const corner = gridRect(scale, view.clip);
    setBox(scrolled, { height: 0, left: -corner.left, top: -corner.top, width: 0 });
    scrolled.style.transform = `translateY(${-scrolling.by}px)`;
    headingParts.forEach((part) => part.place(scrolling.scale));
    for (const [id, row] of rows) {
      const state = motion?.rows.get(id);
      row.tile.place(scrolling.scale, {
        focused: state?.focused ?? false,
        markY: 0,
        x: state?.x ?? 0,
        y: motion?.pressed === id ? FEEDBACK.pressDipPx : 0,
      });
      row.parts.forEach((part) => part.place(scrolling.scale));
    }
  };
  // The rows' controls in the list's order, for the page's focus.
  const tileElements = () => {
    const tiles = new Set<HTMLElement>([...rows.values()].map((row) => row.tile.element));
    return [...scrolled.children].filter((child) =>
      tiles.has(child as HTMLElement),
    ) as HTMLElement[];
  };
  const point = (event: MouseEvent) => input.toGame({ x: event.clientX, y: event.clientY });
  const mount = (ready: readonly Promise<readonly string[]>[]) => {
    page?.destroy();
    let tabPress = false;
    const shownPage = showPage(layer, {
      active: input.active,
      back: input.close,
      chrome: view.page,
      fonts: input.fonts,
      gesture: {
        cancel: () => {
          tabPress = false;
          tabGesture = undefined;
          rowGesture = undefined;
          input.cancel();
        },
        down: (event) => {
          const tab = shownPage.tabAt(event.target as Node);
          tabGesture = tab === undefined ? undefined : inputTabs(view)[tab];
          rowGesture = [...rows].find(([, row]) =>
            row.tile.element.contains(event.target as Node),
          )?.[0];
          tabPress = tab !== undefined;
          if (!tabPress && accepts()) {
            input.down(point(event));
          }
        },
        move: (event) => {
          if (!tabPress && accepts()) {
            input.move(point(event));
          }
        },
        up: (event, cancelled) => {
          const native = tabPress;
          const position = point(event);
          const leftTab =
            tabGesture !== undefined && !containsPoint(tabGesture, position.x, position.y);
          const row = view.rows.find((row) => row.id === rowGesture);
          const leftRow =
            rowGesture !== undefined &&
            (row === undefined ||
              !containsPoint(view.clip, position.x, position.y) ||
              (view.message !== undefined &&
                containsPoint(view.message.rect, position.x, position.y)) ||
              !containsPoint(row.rect, position.x, position.y + (motion?.scroll.y ?? 0)));
          tabPress = false;
          tabGesture = undefined;
          rowGesture = undefined;
          const handled =
            !native && (cancelled || accepts()) ? input.up(position, cancelled) : false;
          return leftTab || leftRow || handled === true;
        },
      },
      list: {
        clip,
        part: {
          get controls() {
            return tileElements();
          },
          element: clip,
          place: (at) => {
            scale = at;
            placeList();
          },
          ready: Promise.all(ready).then((all) => all.flat()),
        },
        scroll: () => ({
          contentHeight: (motion?.scroll.max ?? 0) + SHOP_LAYOUT.list.rect.height,
          viewport: SHOP_LAYOUT.list.rect,
          y: motion?.scroll.y ?? 0,
        }),
      },
      overlays: [
        { element: message, place: (at) => messageParts.forEach((part) => part.place(at)) },
      ],
      tab: (index) => {
        const hit = inputTabs(view)[index];
        if (hit !== undefined) {
          input.click({ x: hit.x + hit.width / 2, y: hit.y + hit.height / 2 });
        }
      },
      toGame: input.toGame,
    });
    const element = shownPage.element;
    element.addEventListener(
      "wheel",
      (event) => {
        if (accepts()) {
          event.preventDefault();
          input.wheel(event.deltaY);
        }
      },
      { passive: false },
    );
    // The page's own controls: its tabs, its rows and Back.
    const onControl = (target: Node) =>
      shownPage.tabAt(target) !== undefined ||
      tileElements().some((tile) => tile.contains(target)) ||
      (target !== element && element.contains(target) && !clip.contains(target));
    // The page moves focus on Tab and its controls take Enter and Space; every other key is the
    // scene's.
    element.addEventListener("keydown", (event) => {
      if (!accepts() || event.code === "Tab") {
        return;
      }
      if (isConfirmKey(event.code) && onControl(event.target as Node)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      input.key(event.code, event.repeat);
    });
    page = shownPage;
    page.setDimmed(dimmed);
    page.setInert(inert);
    page.setShown(shown);
  };
  const update = (next: ShopScreenView) => {
    view = next;
    const ready: Promise<readonly string[]>[] = [];
    const nextChrome = JSON.stringify(view.page);
    const remount = chromeKey !== nextChrome;
    chromeKey = nextChrome;
    const nextHeadings = JSON.stringify(view.headings);
    if (headingsKey !== nextHeadings) {
      headingsKey = nextHeadings;
      headingParts = view.headings.map(headingPart);
      headings.replaceChildren(...headingParts.map(({ element }) => element));
    }
    const retained = new Set<string>();
    for (const row of view.rows) {
      retained.add(row.id);
      const key = JSON.stringify(row);
      if (rows.get(row.id)?.key === key) {
        continue;
      }
      rows.get(row.id)?.dispose();
      rows.get(row.id)?.tile.element.remove();
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
      scrolled.append(tile.element);
      rows.set(row.id, {
        dispose: () => {
          stopFeedback();
          control.dispose();
        },
        key,
        parts,
        tile,
      });
      ready.push(tile.ready);
    }
    for (const [id, row] of rows) {
      if (!retained.has(id)) {
        row.dispose();
        row.tile.element.remove();
        rows.delete(id);
      }
    }
    const nextMessage = JSON.stringify(view.message);
    if (messageKey !== nextMessage) {
      messageKey = nextMessage;
      messageParts = [];
      if (view.message !== undefined) {
        const messageView = view.message;
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
        messageParts.push(
          {
            element: plate.element,
            place: (at) => plate.place(at, ORIGIN, messageView.rect),
          },
          {
            element: content,
            place: (at) => placeBackedText(input.fonts.body, at, ORIGIN, messageView.rect, labels),
          },
        );
        ready.push(plate.ready);
      }
      message.replaceChildren(...messageParts.map(({ element }) => element));
      messageParts.forEach((part) => part.place(scale));
    }
    placeList();
    if (ready.length > 0 || remount || page === undefined) {
      mount(ready);
    }
    page?.follow();
    page?.setEnabled(enabled && input.active());
  };
  update(initial);
  return {
    accepts,
    capture,
    destroy: () => {
      alive = false;
      rows.forEach((row) => row.dispose());
      page?.destroy();
      page = undefined;
    },
    get element() {
      return page!.element;
    },
    focusRow: (id) => {
      if (accepts()) {
        rows.get(id)?.tile.element.focus();
      }
    },
    place: (next) => {
      motion = next;
      placeList();
      page?.follow();
    },
    setDimmed: (next) => {
      dimmed = next;
      page?.setDimmed(next);
    },
    setEnabled: (next) => {
      enabled = next;
      page?.setEnabled(next && input.active());
      if (!next) {
        input.cancel();
      }
    },
    setInert: (next) => {
      inert = next;
      page?.setInert(next);
      if (next) {
        input.cancel();
      }
    },
    setShown: (next) => {
      shown = next;
      page?.setShown(next);
      if (!next) {
        input.cancel();
      }
    },
    update,
  };
}

const inputTabs = (view: ShopScreenView) => shopTabRects(view.page.tabs.length);
