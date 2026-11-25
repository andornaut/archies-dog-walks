import "./logbook.css";

import { containsPoint, type Rect } from "@andornaut/game-kit/runtime/rect";

import { logbookScrollbar, type LogbookView } from "../../home/logbookView.ts";
import type { ShopPageView } from "../../home/shopPageView.ts";
import { earnedBand, statsTabRects } from "../../home/statsLayout.ts";
import { pageCloseControl } from "../../ui/closeControl.ts";
import { contentSeparatorPart } from "../../ui/dom/contentSeparator.ts";
import { createGameButton } from "../../ui/dom/gameButton.ts";
import type { NativeGesture } from "../../ui/dom/modalLifecycle.ts";
import { type DomPart, fillPart, framedBoxPart, framelessView } from "../../ui/dom/parts.ts";
import { setBox } from "../../ui/dom/pixelLine.ts";
import { dimDrawn, followModalUnderlay } from "../../ui/dom/rampDim.ts";
import type { UiLayer } from "../../ui/dom/uiLayer.ts";
import {
  type DomScale,
  gridRect,
  gridX,
  gridY,
  scrollbarBoxes,
  wholeArtPixels,
} from "../../ui/domScale.ts";
import { PALETTE } from "../../ui/palette.ts";
import { artPart, type DomDetailCardInput, textPart } from "./detailCard.ts";
import { bindPanelFeedback } from "./panelButton.ts";
import { type DomQuestionPanel, showQuestionPanel } from "./questionPanel.ts";
import { createPageTab } from "./shopPage.ts";

// The Logbook in HTML over the canvas: the page, its title and Back drawn as a
// panel's (showQuestionPanel), the open tab's content clipped to the list's frame and moved up by
// the scroll, and the scrollbar, at the places the canvas draws them (logbookView).
// It is a page like the Pet shop, not a modal: its top bar stays live, and a modal over it (a
// badge card, the Menu) dims and stills it with the rest of the background.
// Where the list is scrolled to, and whether it has settled: no drag or fling moving it.
export interface LogbookScroll {
  readonly max: number;
  readonly settled: boolean;
  readonly y: number;
}

export type LogbookTarget = { readonly badge: number } | { readonly tab: number };

export interface DomLogbook extends DomQuestionPanel {
  focusBadge(index: number): void;
  setPage(page: ShopPageView): void;
}

export interface DomLogbookInput extends Omit<DomDetailCardInput, "close" | "view"> {
  // Calls step before every frame the game draws, until the returned stop is called.
  readonly everyFrame: (step: () => void) => () => void;
  readonly scroll: () => LogbookScroll;
  readonly view: LogbookView;
  readonly navigation: {
    readonly activate: (target: LogbookTarget) => void;
    // What Back does.
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
  const control = (rect: Rect, label: string, target: LogbookTarget) => {
    const content = doc.createElement("span");
    content.className = "adw-lines";
    const button = createGameButton(doc, {
      appearance: { className: "adw-logbook-badge", face: {}, role: "secondary" },
      content: { icon: content, kind: "icon", name: label },
      getAction: () =>
        shown.accepts() ? { activate: () => input.navigation.activate(target) } : null,
      skin: "authored",
    });
    const stopFeedback = bindPanelFeedback(button, {
      accepts: () => shown.accepts(),
      burst: (event) => shown.burst(input.toGame({ x: event.clientX, y: event.clientY })),
    });
    return {
      content,
      control: button.element,
      dispose: () => {
        stopFeedback();
        button.dispose();
      },
      element: button.element,
      place: (scale: DomScale) => {
        const box = gridRect(scale, rect);
        setBox(button.element, box);
        setBox(button.face, { height: box.height, left: 0, top: 0, width: box.width });
        setBox(content, { height: 0, left: -box.left, top: -box.top, width: 0 });
      },
    };
  };
  const tabs = statsTabRects().flatMap((rect, index) => {
    const tab = view.page.tabs[index];
    if (tab === undefined) {
      return [];
    }
    const part = createPageTab(
      doc,
      {
        font: input.fonts.title,
        press: {
          accepts: () => shown.accepts(),
          burst: (event) => shown.burst(input.toGame({ x: event.clientX, y: event.clientY })),
          press: () => input.navigation.activate({ tab: index }),
        },
      },
      rect,
      tab,
    );
    return [{ ...part, hit: rect }];
  });
  const rowForBox = (box: Rect) =>
    view.wallRows.findIndex(
      (row) =>
        box.x >= row.x &&
        box.x + box.width <= row.x + row.width &&
        box.y >= row.y &&
        box.y + box.height <= row.y + row.height,
    );
  const painted: { readonly part: DomPart; readonly row: number }[] = [
    // Background fills keep their original stacking and coordinates outside action content.
    ...content.fills.map((fill) => ({
      part:
        fill.rect.height === 1 && fill.colour === PALETTE.tan
          ? contentSeparatorPart(doc, "art", fill.rect)
          : fillPart(doc, fill),
      row: -1,
    })),
    ...content.framed.map((framed) => ({
      part: framedBoxPart(doc, framed),
      row: view.wallRows.findIndex((row) => {
        const band = earnedBand(row);
        return (
          band.x === framed.rect.x &&
          band.y === framed.rect.y &&
          band.width === framed.rect.width &&
          band.height === framed.rect.height
        );
      }),
    })),
    ...content.art.map((art) => ({
      part: artPart(doc, input, art),
      row: rowForBox({
        height: art.size.height * art.scale,
        width: art.size.width * art.scale,
        x: art.x,
        y: art.y,
      }),
    })),
    ...content.texts.map((text) => ({
      part: textPart(doc, input, text),
      row: rowForBox({ height: 1, width: 0, x: text.x, y: text.capTop }),
    })),
  ];
  const badges = view.wallRows.map((rect, index) => {
    const name =
      view.content.texts
        .find((line) => line.capTop >= rect.y && line.capTop < rect.y + rect.height)
        ?.lines.join(" ") ?? input.view.page.title.map((line) => line.text).join(" ");
    const part = control(rect, name, { badge: index });
    const children = painted.filter(({ row }) => row === index);
    part.content.append(...children.map(({ part }) => part.element));
    return {
      ...part,
      hit: rect,
      place: (scale: DomScale) => {
        part.place(scale);
        children.forEach(({ part }) => part.place(scale));
      },
      ready: Promise.all(
        children.flatMap(({ part }) => (part.ready === undefined ? [] : [part.ready])),
      ).then((all) => all.flat()),
    };
  });
  const contentParts: DomPart[] = [
    ...painted.filter(({ row }) => row === -1).map(({ part }) => part),
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
  let pageFill = fillPart(doc, page.fill);
  pagePaint.append(pageFill.element);
  let pageScale: DomScale | undefined;
  let dimmed = false;
  const pagePart: DomPart = {
    element: pagePaint,
    place: (scale) => {
      pageScale = scale;
      pageFill.place(scale);
    },
  };
  const tabHost = doc.createElement("div");
  tabHost.className = "adw-lines";
  tabHost.append(...tabs.map((tab) => tab.element));
  const tabPart: DomPart = {
    controls: tabs.flatMap((tab) => tab.controls ?? []),
    element: tabHost,
    place: (scale) => tabs.forEach((tab) => tab.place(scale)),
  };
  let originalHit: Rect | undefined;
  const shown = showQuestionPanel(layer, {
    close: null,
    closeLabel: input.closeLabel,
    fonts: input.fonts,
    footerPress: input.navigation.close,
    gesture: {
      cancel: () => {
        originalHit = undefined;
        input.navigation.gesture.cancel?.();
      },
      down: (event) => {
        const tab = tabs.find((part) =>
          part.controls?.some((control) => control.contains(event.target as Node)),
        );
        const badge = badges.find((part) => part.control.contains(event.target as Node));
        originalHit =
          tab?.hit ??
          (badge === undefined
            ? undefined
            : {
                ...badge.hit,
                y: badge.hit.y - input.scroll().y,
              });
        input.navigation.gesture.down?.(event);
      },
      move: (event) => input.navigation.gesture.move?.(event),
      up: (event, cancelled) => {
        const hit = originalHit;
        originalHit = undefined;
        const point = input.toGame({ x: event.clientX, y: event.clientY });
        const handled = input.navigation.gesture.up?.(event, cancelled);
        return handled === true || (hit !== undefined && !containsPoint(hit, point.x, point.y));
      },
    },
    modal: false,
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
    view: framelessView(page.panel, {
      // The page draws no close control; the panel still places one, which close: null leaves
      // out.
      close: pageCloseControl(page.panel),
      footer: page.back,
      title: page.title,
      titleY: page.title[0]?.capTop ?? page.panel.y,
    }),
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
  const stopUnderlay = followModalUnderlay(layer.input, shown.element);
  return {
    ...shown,
    destroy: () => {
      stop();
      stopUnderlay();
      [...tabs, ...badges].forEach((part) => part.dispose());
      shown.destroy();
    },
    focusBadge: (index) => {
      if (badges[index] !== undefined) {
        shown.focusControl(tabs.length + index);
      }
    },
    setDimmed: (next) => {
      dimmed = next;
      shown.setDimmed(next);
    },
    setPage: (next) => {
      pageFill = fillPart(doc, next.fill);
      pagePaint.replaceChildren(pageFill.element);
      const current = pageScale;
      if (current !== undefined) {
        pageFill.place(current);
      }
      dimDrawn(pagePaint, dimmed);
    },
  };
}
