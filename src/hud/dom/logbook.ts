import type { Rect } from "@andornaut/game-kit/runtime/rect";

import { logbookScrollbar, type LogbookView } from "../../home/logbookView.ts";
import type { ShopPageView } from "../../home/shopPageView.ts";
import { statsTabRects } from "../../home/statsLayout.ts";
import { bindGameAction } from "../../ui/dom/actionBinding.ts";
import type { NativeGesture } from "../../ui/dom/modalLifecycle.ts";
import { setBox } from "../../ui/dom/pixelLine.ts";
import { dimDrawn } from "../../ui/dom/rampDim.ts";
import type { UiLayer } from "../../ui/dom/uiLayer.ts";
import {
  type DomScale,
  gridRect,
  gridX,
  gridY,
  scrollbarBoxes,
  wholeArtPixels,
} from "../../ui/domScale.ts";
import { artPart, type DomDetailCardInput, textPart } from "./detailCard.ts";
import { type DomPart, type DomQuestionPanel, showQuestionPanel } from "./questionPanel.ts";
import { fillPart, framedBoxPart, shopPageParts } from "./shopPage.ts";

// The Logbook in HTML over the canvas: the page (shopPageParts), its title and close control
// drawn as a panel's (showQuestionPanel), the open tab's content clipped to the list's frame and
// moved up by the scroll, and the scrollbar, at the places the canvas draws them (logbookView).
// Where the list is scrolled to, and whether it has settled: no drag or fling moving it.
export interface LogbookScroll {
  readonly max: number;
  readonly settled: boolean;
  readonly y: number;
}

export type LogbookTarget = { readonly badge: number } | { readonly tab: number };

export interface DomLogbook extends DomQuestionPanel {
  setPage(page: ShopPageView): void;
}

export interface DomLogbookInput extends Omit<DomDetailCardInput, "close" | "view"> {
  // Calls step before every frame the game draws, until the returned stop is called.
  readonly everyFrame: (step: () => void) => () => void;
  readonly scroll: () => LogbookScroll;
  readonly view: LogbookView;
  readonly navigation: {
    readonly activate: (target: LogbookTarget) => void;
    readonly close: () => void;
    readonly focus: (rect: Rect) => void;
    readonly gesture: NativeGesture;
    readonly wheel: (deltaY: number) => void;
  };
}

// Where the list's content is laid out at a scroll: the scale its parts are placed at and the
// device pixels the content then moves up by. Once it settles, the content moves up whole art
// pixels. While it moves, each part lands on the device pixel nearest the whole game pixel the
// canvas rounds it to: the parts are placed at a scale whose origin is moved up by the scroll's
// whole game pixels, and the content moves up to that origin's device pixel, so no art lands
// between device pixels and each part stays within half a device pixel of the canvas.
export function scrollPlace(
  scale: DomScale,
  scroll: Pick<LogbookScroll, "settled" | "y">,
): { by: number; scale: DomScale } {
  if (scroll.settled) {
    return { by: wholeArtPixels(scale, scroll.y * scale.unit * scale.dpr), scale };
  }
  const origin = { ...scale.origin, y: scale.origin.y - Math.round(scroll.y) * scale.unit };
  const grid = (page: number) => Math.round(page * scale.dpr);
  return { by: grid(scale.origin.y) - grid(origin.y), scale: { ...scale, origin } };
}

// The scrollbar's track and thumb (scrollbarBoxes) from the track's corner on the art-pixel grid.
function scrollbarPart(doc: Document, input: DomLogbookInput): DomPart & { follow: () => void } {
  const element = doc.createElement("div");
  element.className = "adw-lines";
  const track = doc.createElement("div");
  track.className = "adw-scroll-track";
  const thumb = doc.createElement("div");
  thumb.className = "adw-scroll-thumb";
  element.append(track, thumb);
  let at: DomScale | undefined;
  let shown = "";
  const follow = () => {
    const scroll = input.scroll();
    const bar = logbookScrollbar(scroll.max, scroll.y);
    element.hidden = bar === null;
    if (at === undefined || bar === null) {
      return;
    }
    const key = JSON.stringify([at, bar]);
    if (key === shown) {
      return;
    }
    shown = key;
    const corner = { left: gridX(at, bar.track.x), top: gridY(at, bar.track.y) };
    const boxes = scrollbarBoxes(at, corner, bar);
    setBox(track, boxes.track);
    setBox(thumb, boxes.thumb);
  };
  return {
    element,
    follow,
    place: (scale) => {
      at = scale;
      shown = "";
      follow();
    },
  };
}

// The Logbook in layer, shown and its dialog focused.
export function showLogbook(layer: UiLayer, input: DomLogbookInput): DomLogbook {
  const doc = layer.element.ownerDocument;
  const { view } = input;
  const { content, page } = view;
  // The list's view, and in it the content laid out from the dialog's corner.
  const clip = doc.createElement("div");
  clip.className = "adw-clip";
  clip.style.pointerEvents = "auto";
  const scrolled = doc.createElement("div");
  scrolled.className = "adw-scrolled";
  clip.append(scrolled);
  const control = (
    rect: Rect,
    label: string,
    target: LogbookTarget,
  ): DomPart & { control: HTMLButtonElement } => {
    const element = doc.createElement("button");
    element.type = "button";
    element.className = "adw-button";
    element.style.pointerEvents = "auto";
    element.setAttribute("aria-label", label);
    bindGameAction(
      {
        activate: () => input.navigation.activate(target),
        available: () => shown.accepts(),
        pointer: "release",
      },
      element,
    );
    return { control: element, element, place: (scale) => setBox(element, gridRect(scale, rect)) };
  };
  const tabs = statsTabRects().flatMap((rect, index) => {
    const tab = view.page.tabs[index];
    if (tab === undefined) {
      return [];
    }
    const part = control(rect, tab.label.text, { tab: index });
    part.control.setAttribute("aria-pressed", String(tab.framed));
    return [part];
  });
  const badges = view.wallRows.map((rect, index) => {
    const name =
      view.content.texts
        .find((line) => line.capTop >= rect.y && line.capTop < rect.y + rect.height)
        ?.lines.join(" ") ?? input.view.page.title.map((line) => line.text).join(" ");
    return control(rect, name, { badge: index });
  });
  const contentParts: DomPart[] = [
    ...content.fills.map((fill) => fillPart(doc, fill)),
    ...content.framed.map((framed) => framedBoxPart(doc, framed)),
    ...content.art.map((art) => artPart(doc, input, art)),
    ...content.texts.map((text) => textPart(doc, input, text)),
    ...badges,
  ];
  scrolled.append(...contentParts.map(({ element }) => element));
  let scale: DomScale | undefined;
  let movedBy = Number.NaN;
  // The scale the content's parts were last placed at.
  let placedAt = "";
  const follow = () => {
    if (scale === undefined) {
      return;
    }
    const at = scrollPlace(scale, input.scroll());
    const key = JSON.stringify(at.scale);
    if (key !== placedAt) {
      placedAt = key;
      for (const part of contentParts) {
        part.place(at.scale);
      }
    }
    if (at.by !== movedBy) {
      movedBy = at.by;
      scrolled.style.transform = `translateY(${-at.by}px)`;
    }
  };
  const list: DomPart = {
    controls: badges.map((badge) => badge.control),
    element: clip,
    place: (at) => {
      scale = at;
      const box = gridRect(at, view.frame.rect);
      setBox(clip, box);
      setBox(scrolled, { height: 0, left: -box.left, top: -box.top, width: 0 });
      placedAt = "";
      movedBy = Number.NaN;
      follow();
    },
    ready: Promise.all(
      contentParts.flatMap((part) => (part.ready === undefined ? [] : [part.ready])),
    ).then((all) => all.flat()),
  };
  const scrollbar = scrollbarPart(doc, input);
  const pagePaint = doc.createElement("div");
  pagePaint.className = "adw-lines";
  let pageParts = shopPageParts(doc, input.fonts.title, page);
  pagePaint.append(...pageParts.map((part) => part.element));
  let pageScale: DomScale | undefined;
  let dimmed = false;
  const pagePart: DomPart = {
    element: pagePaint,
    place: (scale) => {
      pageScale = scale;
      pageParts.forEach((part) => part.place(scale));
    },
  };
  const tabHost = doc.createElement("div");
  tabHost.className = "adw-lines";
  tabHost.append(...tabs.map((tab) => tab.element));
  const tabPart: DomPart = {
    controls: tabs.map((tab) => tab.control),
    element: tabHost,
    place: (scale) => tabs.forEach((tab) => tab.place(scale)),
  };
  const shown = showQuestionPanel(layer, {
    close: input.navigation.close,
    closeLabel: input.closeLabel,
    closePressed: page.closePressed,
    fonts: input.fonts,
    gesture: input.navigation.gesture,
    numberKeys: false,
    onFocus: (index) => {
      clip.scrollTop = 0;
      const row = index === undefined ? undefined : view.wallRows[index - tabs.length];
      if (row !== undefined) {
        input.navigation.focus(row);
      }
    },
    parts: [pagePart, tabPart, list, scrollbar],
    presses: [],
    toGame: input.toGame,
    view: {
      buttons: [],
      close: page.close,
      covered: [],
      frame: "none",
      ...(page.footer === undefined ? {} : { footer: page.footer }),
      note: [],
      notePlate: undefined,
      panel: page.card,
      title: page.title,
      titleY: page.title[0]?.capTop ?? page.card.y,
    },
  });
  clip.addEventListener(
    "wheel",
    (event) => {
      if (shown.accepts()) {
        event.preventDefault();
        input.navigation.wheel(event.deltaY);
      }
    },
    { passive: false },
  );
  const stop = input.everyFrame(() => {
    follow();
    scrollbar.follow();
  });
  return {
    ...shown,
    destroy: () => {
      stop();
      shown.destroy();
    },
    setDimmed: (next) => {
      dimmed = next;
      shown.setDimmed(next);
    },
    setPage: (next) => {
      pageParts = shopPageParts(doc, input.fonts.title, next);
      pagePaint.replaceChildren(...pageParts.map((part) => part.element));
      const current = pageScale;
      if (current !== undefined) {
        pageParts.forEach((part) => part.place(current));
      }
      dimDrawn(pagePaint, dimmed);
    },
  };
}
