import "./logbook.css";

import { containsPoint, type Rect } from "@andornaut/game-kit/runtime/rect";

import { type DomPage, showPage, textPart } from "../../home/dom/index.ts";
import {
  type LogbookView,
  type ShopPageView,
  STATS_LAYOUT,
  statsTabRects,
} from "../../home/index.ts";
import {
  bindPanelFeedback,
  contentSeparatorPart,
  createGameButton,
  type DomPart,
  type DomQuestionPanel,
  fillPart,
  framedBoxPart,
  type NativeGesture,
  setBox,
  type UiLayer,
} from "../../ui/dom/index.ts";
import { type DomScale, gridRect, scrollPlace } from "../../ui/index.ts";
import { artPart, type DomDetailCardInput } from "./detailCard.ts";

// The Logbook in HTML over the canvas, on the page template (showPage): the open tab's rules and
// rows, each row one group, clipped to the list's frame and moved up by the scroll, at the places
// logbookView lays out.
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

// The Logbook in layer, shown and its dialog focused.
export function showLogbook(layer: UiLayer, input: DomLogbookInput): DomLogbook {
  const doc = layer.element.ownerDocument;
  const { view } = input;
  const { content } = view;
  // The list's view, and in it the content laid out from the dialog's corner.
  const clip = doc.createElement("div");
  clip.className = "adw-clip";
  clip.style.pointerEvents = "auto";
  const scrolled = doc.createElement("div");
  scrolled.className = "adw-scrolled";
  clip.append(scrolled);
  // A badge's row: its control over rect, the row's parts in it from the content's corner.
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
  // Any other row: a group of its parts from the content's corner.
  const group = () => {
    const element = doc.createElement("div");
    element.className = "adw-lines";
    return { content: element, element, place: () => undefined };
  };
  // Each row as one group of its parts: fills and framed bands under art under text.
  const rows = content.rows.map((row) => {
    const parts: DomPart[] = [
      ...row.fills.map((fill) => fillPart(doc, fill)),
      ...row.framed.map((framed) => framedBoxPart(doc, framed)),
      ...row.art.map((art) => artPart(doc, input, art)),
      ...row.texts.map((text) => textPart(doc, input, text)),
    ];
    const part =
      row.badge === undefined
        ? group()
        : control(row.rect, row.badge.label, { badge: row.badge.index });
    part.content.append(...parts.map(({ element }) => element));
    return {
      ...part,
      place: (scale: DomScale) => {
        part.place(scale);
        parts.forEach((child) => child.place(scale));
      },
      ready: Promise.all(
        parts.flatMap((child) => (child.ready === undefined ? [] : [child.ready])),
      ).then((all) => all.flat()),
      row,
    };
  });
  // The badges' rows, in the wall's order.
  const badges = rows.flatMap((part) => ("control" in part ? [part] : []));
  const contentParts: DomPart[] = [
    ...content.separators.map((rect) => contentSeparatorPart(doc, "art", rect)),
    ...rows,
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
  const tabCount = view.page.tabs.length;
  let originalHit: Rect | undefined;
  const shown: DomPage = showPage(layer, {
    back: input.navigation.close,
    chrome: view.page,
    fonts: input.fonts,
    gesture: {
      cancel: () => {
        originalHit = undefined;
        input.navigation.gesture.cancel?.();
      },
      down: (event) => {
        const tab = statsTabRects()[shown.tabAt(event.target as Node) ?? -1];
        const badge = badges.find((part) => part.control.contains(event.target as Node));
        originalHit =
          tab ??
          (badge === undefined
            ? undefined
            : {
                ...badge.row.rect,
                y: badge.row.rect.y - input.scroll().y,
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
    list: {
      clip,
      part: list,
      scroll: () => {
        const scroll = input.scroll();
        return {
          contentHeight: scroll.max + STATS_LAYOUT.view.height,
          viewport: STATS_LAYOUT.view,
          y: scroll.y,
        };
      },
    },
    onFocus: (index) => {
      clip.scrollTop = 0;
      const badge = index === undefined ? undefined : badges[index - tabCount];
      if (badge !== undefined) {
        input.navigation.focus(badge.row.rect);
      }
    },
    tab: (index) => input.navigation.activate({ tab: index }),
    toGame: input.toGame,
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
    shown.follow();
  });
  return {
    ...shown,
    destroy: () => {
      stop();
      badges.forEach((part) => part.dispose());
      shown.destroy();
    },
    focusBadge: (index) => {
      if (badges[index] !== undefined) {
        shown.focusControl(tabCount + index);
      }
    },
    setPage: (next) => shown.setFill(next.fill),
  };
}
