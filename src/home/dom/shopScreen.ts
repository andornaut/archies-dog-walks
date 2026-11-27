import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";
import type { BitmapFont } from "@andornaut/game-kit/runtime/text/bitmapFont";

import {
  type DomArtSource,
  type DomPart,
  REFUSAL_RED,
  setBox,
  type UiLayer,
} from "../../ui/dom/index.ts";
import { gridRect, type PanelText, scrollPlace, type TileState } from "../../ui/index.ts";
import { SHOP_LAYOUT, type ShopPageView } from "../index.ts";
import { type DomPage, showPage } from "./page.ts";
import type { NativeSelectionTile, NativeTileFill } from "./selectionTile.ts";
import { createShopScreenInput } from "./shopScreenInput.ts";
import { createShopScreenParts } from "./shopScreenParts.ts";

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
  readonly scroll: { readonly max: number; readonly settled: boolean; readonly y: number };
  readonly rows: ReadonlyMap<
    string,
    {
      readonly x: number;
      readonly focused: boolean;
      // Whether the row's refusal is in a red phase (refusalRed).
      readonly refusing?: boolean;
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
  const parts = createShopScreenParts(doc, input);
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
      row.tile.element.toggleAttribute(REFUSAL_RED, state?.refusing === true);
      row.tile.place(scrolling.scale, {
        focused: state?.focused ?? false,
        markY: 0,
        x: state?.x ?? 0,
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
  const inputFlow = createShopScreenInput(
    {
      accepts,
      clip,
      motion: () => motion,
      rowAt: (target) => [...rows].find(([, row]) => row.tile.element.contains(target))?.[0],
      tileElements,
      view: () => view,
    },
    input,
  );
  const mount = (ready: readonly Promise<readonly string[]>[]) => {
    page?.destroy();
    const controls = inputFlow.mount(() => shownPage);
    const shownPage = showPage(layer, {
      active: input.active,
      back: input.close,
      chrome: view.page,
      fonts: input.fonts,
      gesture: controls.gesture,
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
      tab: controls.tab,
      toGame: input.toGame,
    });
    controls.bind(shownPage.element);
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
      headingParts = view.headings.map(parts.headingPart);
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
      const made = parts.rowPart(accepts, row);
      scrolled.append(made.tile.element);
      rows.set(row.id, { ...made, key });
      ready.push(...made.ready);
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
        const made = parts.messageParts(view.message);
        messageParts = made.parts;
        ready.push(made.ready);
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
