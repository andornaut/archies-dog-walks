import "@andornaut/game-kit/runtime/web/ui/dom/pager.css";

import { fillLine } from "@andornaut/game-kit/runtime/lines";
import { createPager } from "@andornaut/game-kit/runtime/web/ui/dom/pager";

import { gameData } from "../../data/index.ts";
import { HELP_DOTS, HELP_LAYOUT, type HelpButton, type HelpView } from "../../help/index.ts";
import { showPage } from "../../home/dom/index.ts";
import { MENU_TEXT_FIELDS } from "../../home/index.ts";
import { holdRule, TILE_SLOP_PX } from "../../input/index.ts";
import {
  addTapBurst,
  bindPanelFeedback,
  colourBox,
  createTextLine,
  type DomBox,
  type DomPart,
  type DomQuestionPanel,
  type DomQuestionPanelInput,
  type DomTextLine,
  placeBox,
  placeFrame,
  placeText,
  refuse,
  setBox,
  type UiLayer,
} from "../../ui/dom/index.ts";
import {
  artPixel,
  BODY_ASCENT_ROWS,
  cssHex,
  type DomScale,
  gridRect,
  gridX,
  gridY,
  PALETTE,
  type PanelText,
} from "../../ui/index.ts";

// Native Help text, page controls, body scrolling and dismissal share the scene's callbacks, on
// the page template (showPage). The canvas keeps the page's backing, the picture's frame and the
// live illustration beneath this logical layout.

export type DomHelpInput = Pick<
  DomQuestionPanelInput,
  "fonts" | "gesture" | "presses" | "toGame"
> & {
  // What Back does.
  readonly footerPress: () => void;
  // Whether a refusal plays without its shake.
  readonly reducedMotion: () => boolean;
  readonly view: HelpView;
};

// Ids that tie each screen's dialog to its page.
let screens = 0;

// Where the dots go, in whole device pixels: each its side in art pixels, the row laid out in
// art pixels from the snapped column under its middle, so every dot and gap is the same size.
function dotBoxes(scale: DomScale, dots: HelpView["dots"]): DomBox[] {
  const first = dots[0]?.rect;
  const last = dots.at(-1)?.rect;
  if (first === undefined || last === undefined) {
    return [];
  }
  const pixel = artPixel(scale);
  const half = Math.floor((last.x + last.width - first.x) / 2);
  const left = gridX(scale, first.x + half) - half * pixel;
  return dots.map(({ rect }) => ({
    height: rect.height * pixel,
    left: left + (rect.x - first.x) * pixel,
    top: gridY(scale, rect.y),
    width: rect.width * pixel,
  }));
}

// The dot element as a dot: filled, or a ring an art pixel wide round the dark screen's colour.
function dotLook(element: HTMLElement, current: boolean): (box: DomBox, pixel: number) => void {
  element.classList.add("adw-framed");
  element.style.borderRadius = "0";
  element.style.backgroundColor = cssHex(current ? HELP_DOTS.current : HELP_DOTS.ring);
  const fill = current ? undefined : colourBox(element.ownerDocument, PALETTE.darkBrown, "span");
  if (fill !== undefined) {
    element.append(fill);
  }
  return (box, pixel) => {
    setBox(element, box);
    if (fill !== undefined) {
      setBox(fill, {
        height: box.height - 2 * pixel,
        left: pixel,
        top: pixel,
        width: box.width - 2 * pixel,
      });
    }
  };
}

// The kit pager (Previous, the page dots and Next) at the places the view lays out: each button
// its press area round its face with its label drawn as a panel button's, and the dots in the
// count between them. A refused step plays the panel buttons' refusal cue (refuse).
function pagerPart(
  input: DomHelpInput,
  doc: Document,
  page: {
    readonly accepts: () => boolean;
    readonly burst: (event: PointerEvent) => void;
  },
): DomPart & { dispose(): void; refuse(direction: -1 | 1): void } {
  const { view } = input;
  const [previous, next] = view.buttons as readonly [HelpButton, HelpButton];
  const pager = createPager(doc, {
    active: page.accepts,
    appearance: {
      className: "adw-reset-button adw-standard-button adw-button adw-secondary",
      contentClassName: "adw-standard-button-content visually-hidden",
      face: { className: "adw-standard-button-face adw-face" },
      layout: "caller",
    },
    countText: ({ page: shown, pages }) =>
      fillLine(MENU_TEXT_FIELDS.help, gameData.menuText.help, "pageCount", {
        n: String(shown + 1),
        total: String(pages),
      }),
    dots: true,
    labels: { next: next.label, previous: previous.label },
    refusal: { reducedMotion: input.reducedMotion, refuse },
    rule: holdRule(gameData.tuning, TILE_SLOP_PX),
    // Next is always available: on the last page it is the completion action.
    state: () => ({
      next: true,
      page: view.page,
      pages: view.dots.length,
      previous: previous.available,
    }),
    step: (direction) => input.presses[direction < 0 ? 0 : 1]?.(),
  });
  Object.assign(pager.element.style, {
    height: "0",
    left: "0",
    position: "absolute",
    top: "0",
    width: "0",
  });
  pager.count.classList.add("adw-framed");
  const buttons = [
    { button: previous, view: pager.previous },
    { button: next, view: pager.next },
  ].map(({ button, view: control }) => {
    const content = doc.createElement("span");
    content.className = "adw-lines";
    const label = createTextLine(doc, button.text);
    label.setAttribute("aria-hidden", "true");
    content.append(label);
    control.face.append(content);
    if (button.pressed) {
      control.setPressed(true);
    }
    const stop = bindPanelFeedback(control, page);
    return {
      place: (scale: DomScale) => {
        placeBox(scale, { x: 0, y: 0 }, control.element, button.hit);
        placeFrame(scale, button.hit, control.face, button.rect);
        placeText(input.fonts.title, scale, button.rect, label, button.text);
      },
      stop,
    };
  });
  const dots = [...pager.count.querySelectorAll<HTMLElement>(".ui-pager-dot")].map((dot, i) =>
    dotLook(dot, view.dots[i]?.current === true),
  );
  // The dots sit at their own places from the count's corner, not in the count's flex row.
  for (const row of pager.count.querySelectorAll<HTMLElement>(".ui-pager-dots")) {
    Object.assign(row.style, { left: "0", position: "absolute", top: "0" });
  }
  return {
    controls: [pager.previous.element, pager.next.element],
    dispose: () => {
      buttons.forEach(({ stop }) => stop());
      pager.dispose();
    },
    element: pager.element,
    place: (scale) => {
      buttons.forEach((button) => button.place(scale));
      const count = gridRect(scale, view.count);
      setBox(pager.count, count);
      const pixel = artPixel(scale);
      dotBoxes(scale, view.dots).forEach((box, i) =>
        dots[i]?.({ ...box, left: box.left - count.left, top: box.top - count.top }, pixel),
      );
    },
    refuse: (direction) => pager.refuse(direction),
  };
}

// Lines of text in parent, placed as the canvas places them.
function textParts(
  input: DomHelpInput,
  parent: HTMLElement,
  lines: readonly PanelText[],
  origin = { x: 0, y: 0 },
): DomPart {
  const doc = parent.ownerDocument;
  const elements = lines.map((line) => {
    const element = createTextLine(doc, line as DomTextLine);
    element.setAttribute("aria-hidden", "true");
    parent.append(element);
    return element;
  });
  return {
    element: parent,
    place: (scale) =>
      lines.forEach((line, i) => {
        const element = elements[i];
        if (element !== undefined) {
          placeText(input.fonts[line.font], scale, origin, element, line);
        }
      }),
  };
}

// The help page in layer, shown and its dialog focused.
export function showHelpScreen(layer: UiLayer, input: DomHelpInput): DomQuestionPanel {
  const doc = layer.element.ownerDocument;
  screens += 1;
  const { view } = input;
  const page = doc.createElement("div");
  page.className = "adw-lines";
  page.id = `adw-help-${screens}`;
  const title = doc.createElement("h3");
  title.className = "adw-lines";
  const body = doc.createElement("p");
  body.className = "adw-lines";
  const clip = doc.createElement("div");
  clip.className = "adw-help-body adw-framed";
  clip.tabIndex = 0;
  clip.setAttribute("role", "region");
  clip.setAttribute("aria-label", view.title.text);
  Object.assign(clip.style, {
    overflowX: "hidden",
    overflowY: "auto",
    overscrollBehavior: "contain",
    pointerEvents: "auto",
    scrollSnapType: "y mandatory",
    scrollbarWidth: "none",
    touchAction: "pan-y",
  });
  clip.addEventListener("keydown", (event) => {
    if (
      [
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "End",
        "Enter",
        "Home",
        "PageDown",
        "PageUp",
        "Space",
      ].includes(event.code)
    ) {
      event.stopPropagation();
    }
  });
  clip.append(body);
  const bodyLines = view.body.lines.map((text, i): PanelText => ({
    capTop: view.body.capTop + i * view.body.pitch,
    centre: "left",
    centreX: view.body.x,
    colour: view.body.colour,
    font: "body",
    line: 0,
    scale: view.body.scale,
    text,
  }));
  const titleText = textParts(input, title, [view.title]);
  const caption = doc.createElement("p");
  caption.className = "adw-lines";
  const captionText = textParts(input, caption, [view.caption]);
  caption.setAttribute("aria-hidden", "true");
  // The lines from the first's slot, its letters' top: the viewport shows whole slots, and a
  // scroll comes to rest on one.
  const slotTop = view.body.capTop - BODY_ASCENT_ROWS * view.body.scale;
  const bodyText = textParts(input, body, bodyLines, { x: 0, y: slotTop });
  const slots = view.body.lines.map(() => {
    const slot = doc.createElement("div");
    slot.className = "adw-framed";
    slot.style.scrollSnapAlign = "start";
    body.append(slot);
    return slot;
  });
  // A screen reader reads the page's title and body as written.
  for (const [element, text] of [
    [title, view.title.text],
    [body, view.body.lines.join(" ")],
  ] as const) {
    const spoken = doc.createElement("span");
    spoken.className = "visually-hidden";
    spoken.textContent = text;
    element.append(spoken);
  }
  page.append(caption, title, clip);
  // A press anywhere on the page under the top bar's press columns, away from its controls, is a
  // page press (the scene's gesture).
  const surface = doc.createElement("div");
  surface.setAttribute("aria-hidden", "true");
  Object.assign(surface.style, { pointerEvents: "auto", position: "absolute" });
  const surfacePart: DomPart = {
    element: surface,
    place: (scale) => setBox(surface, gridRect(scale, HELP_LAYOUT.presses)),
  };
  const pager = pagerPart(input, doc, {
    accepts: () => shown.accepts(),
    burst: (event) => addTapBurst(layer, input.toGame({ x: event.clientX, y: event.clientY })),
  });
  const bodyPart: DomPart = {
    controls: [clip],
    element: page,
    place: (scale) => {
      setBox(clip, gridRect(scale, HELP_LAYOUT.body.viewport));
      const content = gridRect(scale, {
        height: view.body.lines.length * view.body.pitch,
        width: HELP_LAYOUT.screen.width,
        x: 0,
        y: slotTop,
      });
      setBox(body, { height: content.height, left: 0, top: 0, width: content.width });
      slots.forEach((slot, i) => {
        const top = gridY(scale, slotTop + i * view.body.pitch) - content.top;
        const bottom = gridY(scale, slotTop + (i + 1) * view.body.pitch) - content.top;
        setBox(slot, { height: bottom - top, left: 0, top, width: content.width });
      });
      captionText.place(scale);
      titleText.place(scale);
      bodyText.place(scale);
    },
  };
  let scrollingBody = false;
  const gesture =
    input.gesture === undefined
      ? undefined
      : {
          cancel: () => {
            scrollingBody = false;
            input.gesture?.cancel?.();
          },
          down: (event: PointerEvent) => {
            scrollingBody = clip.contains(event.target as Node);
            if (scrollingBody) {
              input.gesture?.cancel?.();
            } else {
              input.gesture?.down?.(event);
            }
          },
          move: (event: PointerEvent) => {
            if (!scrollingBody) {
              input.gesture?.move?.(event);
            }
          },
          up: (event: PointerEvent, cancelled: boolean) => {
            const scroll = scrollingBody;
            scrollingBody = false;
            return scroll ? false : input.gesture?.up?.(event, cancelled);
          },
        };
  const shown = showPage(layer, {
    back: input.footerPress,
    chrome: { back: view.footer },
    describedBy: page.id,
    fonts: input.fonts,
    ...(gesture === undefined ? {} : { gesture }),
    label: view.label,
    list: {
      clip,
      part: bodyPart,
      scroll: () => ({
        contentHeight: view.body.lines.length * view.body.pitch,
        viewport: HELP_LAYOUT.body.viewport,
      }),
    },
    // The pager after the body, so focus moves from the body to Previous and Next, then Back.
    overlays: [pager],
    parts: [surfacePart],
    toGame: input.toGame,
  });
  return {
    ...shown,
    destroy: () => {
      pager.dispose();
      shown.destroy();
    },
    refuse: (index) => {
      if (index === 0) {
        pager.refuse(-1);
      }
    },
  };
}
