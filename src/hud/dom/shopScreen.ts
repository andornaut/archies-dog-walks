import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";
import type { BitmapFont } from "@andornaut/game-kit/runtime/text/bitmapFont";

import { SLICES } from "../../data/layout.ts";
import {
  createSelectionTile,
  type NativeSelectionTile,
  type NativeTileFill,
} from "../../home/dom/selectionTile.ts";
import { FEEDBACK } from "../../home/feedback.ts";
import { shopTabRects } from "../../home/shopLayout.ts";
import type { ShopPageView } from "../../home/shopPageView.ts";
import { bindGameAction } from "../../ui/dom/actionBinding.ts";
import { type DomArtSource, imageArt, imageNineSlice, sheetArt } from "../../ui/dom/artElements.ts";
import { type ModalLifecycle, mountModalLifecycle } from "../../ui/dom/modalLifecycle.ts";
import {
  createTextLine,
  placeBackedText,
  placeBox,
  placeText,
  setBox,
} from "../../ui/dom/pixelLine.ts";
import { dimDrawn, followModalUnderlay } from "../../ui/dom/rampDim.ts";
import type { UiLayer } from "../../ui/dom/uiLayer.ts";
import {
  type DomScale,
  gridRect,
  gridTransform,
  gridX,
  gridY,
  scrollbarBoxes,
} from "../../ui/domScale.ts";
import type { TileState } from "../../ui/interaction.ts";
import type { PanelText } from "../../ui/modal/types.ts";
import type { ScrollbarRects } from "../../ui/scrollbar.ts";
import { SELECT_OUTSET } from "../../ui/selection.ts";
import { scrollPlace } from "./logbook.ts";
import { createPanelButton } from "./panelButton.ts";
import { addTapBurst, type DomPart } from "./questionPanel.ts";
import { fillPart, shopPageParts } from "./shopPage.ts";

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
  readonly message?: { readonly rect: Rect; readonly lines: readonly PanelText[] };
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
  capture(): () => boolean;
  destroy(): void;
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
  root.style.transformOrigin = "0 0";
  root.tabIndex = -1;
  root.setAttribute("aria-label", initial.page.title.map((line) => line.text).join(" "));
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
    enabled = true,
    inert = false,
    dimmed = false;
  let view = initial;
  let footer: HTMLElement | undefined;
  let footerGesture = false;
  let scale = layer.scale();
  let motion: ShopScreenMotion | undefined;
  let lifecycle: ModalLifecycle | undefined;
  const dimListeners = new Set<() => void>();
  const coverage = {
    accepts: () => !dimmed && layer.input.accepts(),
    subscribe: (listener: () => void) => {
      dimListeners.add(listener);
      const stop = layer.input.subscribe(listener);
      return () => {
        dimListeners.delete(listener);
        stop();
      };
    },
  };
  let chromeParts: DomPart[] = [],
    headingParts: DomPart[] = [],
    messageParts: DomPart[] = [];
  let disposeFooter: (() => void) | undefined;
  const rows = new Map<string, { key: string; tile: NativeSelectionTile; parts: DomPart[] }>();
  let chromeKey = "",
    headingsKey = "",
    messageKey = "";
  const textPart = (line: PanelText, origin: Point = ORIGIN): DomPart => {
    const element = createTextLine(doc, line);
    return { element, place: (at) => placeText(input.fonts[line.font], at, origin, element, line) };
  };
  const controlPoints = new WeakMap<HTMLElement, Point>();
  const control = (rect: Rect, label: string) => {
    const element = doc.createElement("button");
    element.type = "button";
    element.className = "adw-button";
    element.style.pointerEvents = "auto";
    element.setAttribute("aria-label", label);
    const point = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    controlPoints.set(element, point);
    bindGameAction(
      {
        activate: () => input.click(point),
        available: accepts,
        pointer: "release",
      },
      element,
    );
    return { element, place: (at: DomScale) => setBox(element, gridRect(at, rect)) };
  };
  const accepts = () => alive && input.active() && lifecycle?.accepts() === true;
  const capture = () => {
    const admitted = accepts();
    const check = lifecycle?.capture() ?? (() => false);
    return () => admitted && check() && accepts();
  };
  const syncDim = () => dimDrawn(root, !coverage.accepts());
  const redraw = () => {
    root.style.transform = gridTransform(scale);
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
    const nextChrome = JSON.stringify(view.page);
    if (chromeKey !== nextChrome) {
      disposeFooter?.();
      chromeKey = nextChrome;
      chromeParts = shopPageParts(doc, input.fonts.title, view.page);
      chromeParts.push(...view.page.title.map((line) => textPart(line)));
      // Tabs retain their shared drawn geometry and expose their complete target as controls.
      view.page.tabs.forEach((tab, i) => {
        const hit = inputTabs(view)[i];
        if (hit !== undefined) {
          chromeParts.push(control(hit, tab.label.text));
        }
      });
      const action = createPanelButton(
        doc,
        {
          fonts: input.fonts,
          press: {
            accepts,
            burst: (event) => addTapBurst(layer, point(event)),
            press: input.close,
          },
        },
        view.page.back,
      );
      footer = action.element;
      disposeFooter = action.dispose;
      footer.classList.add("adw-footer");
      chromeParts.push(action);
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
      const tile = createSelectionTile(doc, input.source, input.fonts.title, {
        frame: row.frame,
        hit: row.rect,
        label: row.label,
        mark: "none",
        outset: SELECT_OUTSET,
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
      const point = { x: row.rect.x + row.rect.width / 2, y: row.rect.y + row.rect.height / 2 };
      controlPoints.set(tile.element, point);
      bindGameAction(
        {
          activate: () => input.click(point),
          available: accepts,
          ...(row.holdDetail === true ? { hold: { external: "shop-item-detail" as const } } : {}),
          pointer: "release",
        },
        tile.element,
      );
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
    }
    redraw();
    syncDim();
    if (ready.length > 0 || lifecycle === undefined) {
      lifecycle?.destroy();
      lifecycle = mountModalLifecycle(
        layer,
        {
          gesture: {
            cancel: () => {
              footerGesture = false;
              input.cancel();
            },
            down: (event) => {
              footerGesture = footer?.contains(event.target as Node) === true;
              if (!footerGesture && accepts()) {
                input.down(point(event));
              }
            },
            move: (event) => {
              if (!footerGesture && accepts()) {
                input.move(point(event));
              }
            },
            up: (event, cancelled) => {
              const native = footerGesture;
              footerGesture = false;
              if (!native && (cancelled || accepts())) {
                input.up(point(event), cancelled);
              }
            },
          },
          modal: false,
          reveal: layer.reveal(
            Promise.all(ready).then((all) => all.flat()),
            root,
          ),
        },
        root,
      );
      lifecycle.setInert(inert);
      lifecycle.setShown(shown);
    }
    lifecycle.setEnabled(enabled && input.active());
  };
  const stopScale = layer.onScale((next) => {
    scale = next;
    redraw();
  });
  const stopUnderlay = followModalUnderlay(coverage, root);
  const point = (event: MouseEvent) => input.toGame({ x: event.clientX, y: event.clientY });
  update(initial);
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
      if (
        footer?.contains(event.target as Node) &&
        (event.code === "Enter" || event.code === "Space")
      ) {
        if (event.repeat) {
          event.preventDefault();
        }
        event.stopPropagation();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (footer !== undefined && event.code === "Tab") {
        const controls: HTMLElement[] = [];
        const collect = (node: HTMLElement) => {
          if (node.hidden) {
            return;
          }
          if (node.tagName.toLowerCase() === "button") {
            controls.push(node);
          }
          for (const child of node.children) {
            collect(child as HTMLElement);
          }
        };
        collect(root);
        const at = controls.indexOf(doc.activeElement as HTMLElement);
        const next =
          at < 0
            ? event.shiftKey
              ? controls.length - 1
              : 0
            : (at + (event.shiftKey ? controls.length - 1 : 1)) % controls.length;
        (controls[next] ?? root).focus();
        return;
      }
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
    capture,
    destroy: () => {
      alive = false;
      disposeFooter?.();
      disposeFooter = undefined;
      stopUnderlay();
      stopScale();
      lifecycle?.destroy();
      root.remove();
    },
    element: root,
    place: (next) => {
      motion = next;
      redraw();
    },
    setDimmed: (next) => {
      if (dimmed !== next) {
        dimmed = next;
        dimListeners.forEach((listener) => listener());
      }
    },
    setEnabled: (next) => {
      enabled = next;
      lifecycle?.setEnabled(next && input.active());
      if (!next) {
        input.cancel();
      }
    },
    setInert: (next) => {
      inert = next;
      lifecycle?.setInert(next);
      if (next) {
        input.cancel();
      }
    },
    setShown: (next) => {
      shown = next;
      lifecycle?.setShown(next);
      if (!next) {
        input.cancel();
      }
    },
    update,
  };
}

const inputTabs = (view: ShopScreenView) => shopTabRects(view.page.tabs.length);
