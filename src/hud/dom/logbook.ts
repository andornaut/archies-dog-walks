import { logbookScrollbar, type LogbookView } from "../../home/logbookView.ts";
import { setBox } from "../../ui/dom/pixelLine.ts";
import type { UiLayer } from "../../ui/dom/uiLayer.ts";
import {
  artPixel,
  deviceRect,
  type DomScale,
  frameRect,
  wholeArtPixels,
} from "../../ui/domScale.ts";
import { artPart, type DomDetailCardInput, textPart } from "./detailCard.ts";
import { type DomPart, type DomQuestionPanel, showQuestionPanel } from "./questionPanel.ts";
import { fillPart, framedBoxPart, shopPageParts } from "./shopPage.ts";

// The Logbook in HTML over the canvas: the page (shopPageParts), its title and close control
// drawn as a panel's (showQuestionPanel), the open tab's content clipped to the list's frame and
// moved up by the scroll, and the scrollbar, at the places the canvas draws them (logbookView).
// It takes no presses: the scene takes every tap, drag, wheel turn and key, as on the canvas,
// and draws it again as they change it; the scroll it follows before every frame.

// Where the list is scrolled to, and whether it has settled: no drag or fling moving it.
export interface LogbookScroll {
  readonly max: number;
  readonly settled: boolean;
  readonly y: number;
}

export interface DomLogbookInput extends Omit<DomDetailCardInput, "close" | "view"> {
  // Calls step before every frame the game draws, until the returned stop is called.
  readonly everyFrame: (step: () => void) => () => void;
  readonly scroll: () => LogbookScroll;
  readonly view: LogbookView;
}

// The device pixels the content moves up by at a scroll: while it moves, the whole game pixels
// the canvas rounds its art to, on the device pixel nearest, so no art lands between device
// pixels and the HTML keeps within a device pixel of the canvas; once it settles, whole art
// pixels.
export function scrolledBy(scale: DomScale, scroll: Pick<LogbookScroll, "settled" | "y">): number {
  const perGamePixel = scale.unit * scale.dpr;
  return scroll.settled
    ? wholeArtPixels(scale, scroll.y * perGamePixel)
    : Math.round(Math.round(scroll.y) * perGamePixel);
}

// The scrollbar's track and thumb, the thumb whole art pixels from the track's snapped top.
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
    const pixel = artPixel(at);
    const box = frameRect(at, bar.track);
    setBox(track, box);
    const top = box.top + wholeArtPixels(at, deviceRect(at, bar.thumb).top - box.top);
    setBox(thumb, {
      height: wholeArtPixels(at, deviceRect(at, bar.thumb).height),
      left: box.left + (bar.thumb.x - bar.track.x) * pixel,
      top,
      width: bar.thumb.width * pixel,
    });
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
export function showLogbook(layer: UiLayer, input: DomLogbookInput): DomQuestionPanel {
  const doc = layer.element.ownerDocument;
  const { view } = input;
  const { content, page } = view;
  // The list's view, and in it the content laid out from the dialog's corner.
  const clip = doc.createElement("div");
  clip.className = "adw-clip";
  const scrolled = doc.createElement("div");
  scrolled.className = "adw-scrolled";
  clip.append(scrolled);
  const contentParts: DomPart[] = [
    ...content.fills.map((fill) => fillPart(doc, fill)),
    ...content.framed.map((framed) => framedBoxPart(doc, framed)),
    ...content.art.map((art) => artPart(doc, input, art)),
    ...content.texts.map((text) => textPart(doc, input, text)),
  ];
  scrolled.append(...contentParts.map(({ element }) => element));
  let scale: DomScale | undefined;
  let movedBy = Number.NaN;
  const follow = () => {
    if (scale === undefined) {
      return;
    }
    const by = scrolledBy(scale, input.scroll());
    if (by !== movedBy) {
      movedBy = by;
      scrolled.style.transform = `translateY(${-by}px)`;
    }
  };
  const list: DomPart = {
    element: clip,
    place: (at) => {
      scale = at;
      const box = deviceRect(at, view.frame.rect);
      setBox(clip, box);
      setBox(scrolled, { height: 0, left: -box.left, top: -box.top, width: 0 });
      for (const part of contentParts) {
        part.place(at);
      }
      movedBy = Number.NaN;
      follow();
    },
  };
  const scrollbar = scrollbarPart(doc, input);
  const shown = showQuestionPanel(layer, {
    close: undefined,
    closeLabel: input.closeLabel,
    closePressed: page.closePressed,
    fonts: input.fonts,
    numberKeys: false,
    parts: [...shopPageParts(doc, input.fonts.title, page), list, scrollbar],
    presses: [],
    toGame: input.toGame,
    view: {
      buttons: [],
      close: page.close,
      covered: [],
      frame: "none",
      note: [],
      notePlate: undefined,
      panel: page.card,
      title: [page.title],
      titleY: page.title.capTop,
    },
  });
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
  };
}
