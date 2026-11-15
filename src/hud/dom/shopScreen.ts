import type { Point, Rect } from "@andornaut/game-kit/rect";
import type { BitmapFont } from "@andornaut/game-kit/text/bitmapFont";

import { SLICES } from "../../data/layout.ts";
import {
  createSelectionTile,
  type NativeSelectionTile,
  type NativeTileFill,
} from "../../home/dom/selectionTile.ts";
import { FEEDBACK } from "../../home/feedback.ts";
import { shopTabRects } from "../../home/shopLayout.ts";
import type { ShopPageView } from "../../home/shopPageView.ts";
import { type DomArtSource, imageArt, sheetArt, sheetNineSlice } from "../../ui/dom/artElements.ts";
import { guardNativeInput, revealPaint } from "../../ui/dom/modalLifecycle.ts";
import {
  createTextLine,
  placeBackedText,
  placeBox,
  placeText,
  setBox,
} from "../../ui/dom/pixelLine.ts";
import { dimDrawn, followModalUnderlay } from "../../ui/dom/rampDim.ts";
import type { UiLayer } from "../../ui/dom/uiLayer.ts";
import { type DomScale, gridRect, gridX, gridY, scrollbarBoxes } from "../../ui/domScale.ts";
import type { TileState } from "../../ui/interaction.ts";
import type { PanelText } from "../../ui/modal/types.ts";
import type { ScrollbarRects } from "../../ui/scrollbar.ts";
import { scrollPlace } from "./logbook.ts";
import type { DomPart } from "./questionPanel.ts";
import { fillPart, shopPageParts } from "./shopPage.ts";

export interface ShopScreenArt {
  readonly key: string;
  readonly imageKey?: string;
  readonly rect: Rect;
  readonly sheet: boolean;
  readonly tag?: string;
}

export interface ShopScreenRow {
  readonly id: string;
  readonly label: string;
  readonly rect: Rect;
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
  readonly headings: readonly PanelText[];
  readonly rows: readonly ShopScreenRow[];
  readonly message?: { readonly rect: Rect; readonly line: PanelText };
}

export interface ShopScreenMotion {
  readonly pressed?: string;
  readonly scroll: { readonly max: number; readonly settled: boolean; readonly y: number };
  readonly scrollbar: ScrollbarRects | null;
  readonly rows: ReadonlyMap<
    string,
    {
      readonly x: number;
      readonly frame: readonly NativeTileFill[];
      readonly orbit: readonly NativeTileFill[];
    }
  >;
}

export interface NativeShopScreen {
  readonly element: HTMLElement;
  accepts(): boolean;
  destroy(): void;
  setShown(shown: boolean): void;
  update(view: ShopScreenView): void;
  place(motion: ShopScreenMotion): void;
}

export interface ShopScreenInput {
  readonly closeLabel: string;
  readonly source: DomArtSource;
  readonly fonts: Readonly<Record<"body" | "title", BitmapFont>>;
  readonly toGame: (client: Point) => Point;
  readonly active: () => boolean;
  readonly painted: () => void;
  readonly cancel: () => void;
  readonly down: (point: Point) => void;
  readonly move: (point: Point) => void;
  readonly up: (point: Point, cancelled: boolean) => void;
  readonly wheel: (deltaY: number) => void;
  readonly key: (code: string, repeat: boolean) => void;
  readonly click: (point: Point) => void;
}

const ORIGIN = { x: 0, y: 0 };

// The scene owns purchases and gestures. This persistent surface owns only native painting.
export function showShopScreen(
  layer: UiLayer,
  input: ShopScreenInput,
  initial: ShopScreenView,
): NativeShopScreen {
  const doc = layer.element.ownerDocument;
  const root = doc.createElement("section");
  root.className = "adw-lines";
  root.setAttribute("aria-label", initial.page.title.text);
  const chrome = doc.createElement("div");
  chrome.className = "adw-lines";
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
  const bar = doc.createElement("div");
  bar.className = "adw-lines";
  const track = doc.createElement("div"),
    thumb = doc.createElement("div");
  track.className = "adw-scroll-track";
  thumb.className = "adw-scroll-thumb";
  bar.append(track, thumb);
  root.append(chrome, clip, bar, message);
  layer.element.append(root);
  let alive = true,
    shown = true,
    revision = 0;
  let view = initial;
  let scale = layer.scale();
  let motion: ShopScreenMotion | undefined;
  let paint: ReturnType<typeof revealPaint> | undefined;
  let chromeParts: DomPart[] = [],
    headingParts: DomPart[] = [],
    messageParts: DomPart[] = [];
  const controlPoints = new WeakMap<HTMLElement, Point>();
  const rows = new Map<string, { key: string; tile: NativeSelectionTile; parts: DomPart[] }>();
  let chromeKey = "",
    headingsKey = "",
    messageKey = "";
  const textPart = (line: PanelText, origin: Point = ORIGIN): DomPart => {
    const element = createTextLine(doc, line);
    return { element, place: (at) => placeText(input.fonts[line.font], at, origin, element, line) };
  };
  const control = (rect: Rect, label: string) => {
    const element = doc.createElement("button");
    element.type = "button";
    element.className = "adw-button";
    element.style.pointerEvents = "auto";
    element.setAttribute("aria-label", label);
    controlPoints.set(element, { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
    return { element, place: (at: DomScale) => setBox(element, gridRect(at, rect)) };
  };
  const accepts = () =>
    alive && shown && input.active() && layer.input.accepts() && paint?.painted() === true;
  const syncDim = () => dimDrawn(root, !layer.input.accepts());
  const redraw = () => {
    chromeParts.forEach((part) => part.place(scale));
    messageParts.forEach((part) => part.place(scale));
    setBox(clip, gridRect(scale, view.clip));
    const scrolling = scrollPlace(scale, motion?.scroll ?? { settled: true, y: 0 });
    const corner = gridRect(scale, view.clip);
    setBox(scrolled, { height: 0, left: -corner.left, top: -corner.top, width: 0 });
    scrolled.style.transform = `translateY(${-scrolling.by}px)`;
    headingParts.forEach((part) => part.place(scrolling.scale));
    for (const [id, row] of rows) {
      const state = motion?.rows.get(id);
      row.tile.setFrameFills(state?.frame ?? []);
      row.tile.setOrbit(state?.orbit ?? []);
      row.tile.place(scrolling.scale, {
        markY: 0,
        x: state?.x ?? 0,
        y: motion?.pressed === id ? FEEDBACK.pressDipPx : 0,
      });
      row.parts.forEach((part) => part.place(scrolling.scale));
    }
    const scrollbar = motion?.scrollbar;
    bar.hidden = scrollbar === null || scrollbar === undefined;
    if (scrollbar !== null && scrollbar !== undefined) {
      const boxes = scrollbarBoxes(
        scale,
        { left: gridX(scale, scrollbar.track.x), top: gridY(scale, scrollbar.track.y) },
        scrollbar,
      );
      setBox(track, boxes.track);
      setBox(thumb, boxes.thumb);
    }
  };
  const update = (next: ShopScreenView) => {
    view = next;
    const ready: Promise<readonly string[]>[] = [];
    const nextChrome = JSON.stringify({ ...view.page, closePressed: false });
    if (chromeKey !== nextChrome) {
      chromeKey = nextChrome;
      chromeParts = shopPageParts(doc, input.fonts.title, view.page);
      chromeParts.push(textPart(view.page.title));
      const face = sheetArt(doc, input.source, "ui-icon-button");
      const glyph = imageArt(doc, input.source, "icon-close");
      const { close } = view.page;
      const button = control(close.hit, input.closeLabel);
      button.element.append(face.element, glyph.element);
      chromeParts.push({
        element: button.element,
        place: (at) => {
          button.place(at);
          const origin = close.hit;
          face.place(at, origin, {
            tag: view.page.closePressed ? "pressed" : "normal",
            x: close.x,
            y: close.y,
          });
          glyph.place(at, origin, { height: 16, width: 16, x: close.x + 2, y: close.y + 1 });
        },
      });
      if (paint === undefined) {
        ready.push(face.ready, glyph.ready);
      }
      // Tabs retain their shared drawn geometry and expose their complete target as controls.
      view.page.tabs.forEach((tab, i) => {
        const hit = inputTabs(view)[i];
        if (hit !== undefined) {
          chromeParts.push(control(hit, tab.label.text));
        }
      });
      chrome.replaceChildren(...chromeParts.map(({ element }) => element));
      chrome.style.pointerEvents = "auto";
    }
    const nextHeadings = JSON.stringify(view.headings);
    if (headingsKey !== nextHeadings) {
      headingsKey = nextHeadings;
      headingParts = view.headings.map((line) => textPart(line));
      headings.replaceChildren(...headingParts.map(({ element }) => element));
    }
    const retained = new Set<string>();
    for (const row of view.rows) {
      retained.add(row.id);
      const key = JSON.stringify(row);
      if (rows.get(row.id)?.key === key) {
        continue;
      }
      rows.get(row.id)?.tile.element.remove();
      const tile = createSelectionTile(doc, input.source, {
        hit: row.rect,
        label: row.label,
        rect: row.rect,
        state: row.state,
      });
      const parts: DomPart[] = row.fills.map((fill) => {
        const part = fillPart(doc, fill);
        return {
          element: part.element,
          place: (at) => placeBox(at, row.rect, part.element, fill.rect),
        };
      });
      parts.push(...row.texts.map((line) => textPart(line, row.rect)));
      for (const art of row.art) {
        if (art.sheet) {
          const part = sheetArt(doc, input.source, art.key, art.imageKey);
          parts.push({
            element: part.element,
            place: (at) =>
              part.place(at, row.rect, {
                ...art.rect,
                ...(art.tag === undefined ? {} : { tag: art.tag }),
              }),
          });
          ready.push(part.ready);
        } else {
          const part = imageArt(doc, input.source, art.imageKey ?? art.key);
          parts.push({ element: part.element, place: (at) => part.place(at, row.rect, art.rect) });
          ready.push(part.ready);
        }
      }
      if (row.plate !== undefined) {
        const plate = row.plate;
        for (const fill of plate.fills) {
          const element = doc.createElement("span");
          element.className = "adw-framed";
          element.style.backgroundColor = `#${fill.colour.toString(16).padStart(6, "0")}`;
          parts.push({ element, place: (at) => placeBox(at, row.rect, element, fill.rect) });
        }
        const element = createTextLine(doc, plate.label);
        parts.push({
          element,
          place: (at) =>
            placeBackedText(input.fonts.body, at, row.rect, plate.rect, [
              { element, line: plate.label },
            ]),
        });
      }
      controlPoints.set(tile.element, {
        x: row.rect.x + row.rect.width / 2,
        y: row.rect.y + row.rect.height / 2,
      });
      tile.content.append(...parts.map(({ element }) => element));
      scrolled.append(tile.element);
      rows.set(row.id, { key, parts, tile });
      ready.push(tile.ready);
    }
    for (const [id, row] of rows) {
      if (!retained.has(id)) {
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
        const plate = sheetNineSlice(doc, input.source, "ui-hint", SLICES["ui-hint"]);
        messageParts.push(
          {
            element: plate.element,
            place: (at) => plate.place(at, ORIGIN, { ...messageView.rect, tag: "still" }),
          },
          textPart(messageView.line),
        );
        ready.push(plate.ready);
      }
      message.replaceChildren(...messageParts.map(({ element }) => element));
    }
    redraw();
    syncDim();
    if (ready.length > 0 || paint === undefined) {
      revision += 1;
      paint?.destroy();
      paint = revealPaint(
        layer.reveal(
          Promise.all(ready).then((all) => all.flat()),
          root,
        ),
        input.painted,
        root,
      );
    }
  };
  const stopScale = layer.onScale((next) => {
    scale = next;
    redraw();
  });
  const stopUnderlay = followModalUnderlay(layer.input, root);
  update(initial);
  const point = (event: MouseEvent) => input.toGame({ x: event.clientX, y: event.clientY });
  const stopInput = guardNativeInput(
    {
      cancel: input.cancel,
      down: (event) => input.down(point(event)),
      gate: {
        accepts,
        capture: () => {
          const accepted = accepts(),
            stamp = revision,
            check = layer.input.capture();
          return () => accepted && stamp === revision && check() && accepts();
        },
      },
      move: (event) => input.move(point(event)),
      subscribe: layer.input.subscribe,
      up: (event, cancelled) => input.up(point(event), cancelled),
    },
    root,
  );
  const controlPoint = (target: EventTarget | null): Point | undefined => {
    let node = target as HTMLElement | null;
    while (node !== null && node !== root) {
      const point = controlPoints.get(node);
      if (point !== undefined) {
        return point;
      }
      node = node.parentElement;
    }
    return undefined;
  };
  root.addEventListener("click", (event) => {
    const point = controlPoint(event.target);
    if (event.detail === 0 && accepts() && point !== undefined) {
      input.click(point);
    }
  });
  root.addEventListener(
    "wheel",
    (event) => {
      if (accepts()) {
        event.preventDefault();
        input.wheel(event.deltaY);
      }
    },
    { passive: false },
  );
  root.addEventListener("keydown", (event) => {
    if (accepts()) {
      event.preventDefault();
      event.stopPropagation();
      const target = controlPoint(event.target);
      if ((event.code === "Enter" || event.code === "Space") && target !== undefined) {
        if (!event.repeat) {
          input.click(target);
        }
      } else {
        input.key(event.code, event.repeat);
      }
    }
  });
  return {
    accepts,
    destroy: () => {
      alive = false;
      stopInput();
      stopUnderlay();
      stopScale();
      paint?.destroy();
      root.remove();
    },
    element: root,
    place: (next) => {
      motion = next;
      redraw();
    },
    setShown: (next) => {
      shown = next;
      root.hidden = !next;
      if (!next) {
        input.cancel();
      }
    },
    update,
  };
}

const inputTabs = (view: ShopScreenView) => shopTabRects(view.page.tabs.length);
