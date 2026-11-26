import "@andornaut/game-kit/runtime/web/ui/dom/modalFrame.css";

import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";
import { createModalFrame } from "@andornaut/game-kit/runtime/web/ui/dom/modalFrame";

import { SCREEN_CONFIG } from "../../data/index.ts";
import { setBox } from "../../ui/dom/index.ts";
import {
  cardTitleRow,
  deviceX,
  deviceY,
  type DomScale,
  frameRect,
  gridRect,
  gridX,
  gridY,
  type PanelText,
} from "../../ui/index.ts";

// The frame places its slots from the card; the game's existing authored parts use screen
// coordinates. Keep the screen grid inside each slot, including for parts that repaint on their own.
function screenHost(doc: Document, slot: HTMLElement, tag: "div" | "span" = "div") {
  const element = doc.createElement(tag);
  element.className = "adw-lines";
  slot.append(element);
  return {
    element,
    place(scale: DomScale, corner: Point) {
      setBox(element, {
        height: deviceY(scale, SCREEN_CONFIG.height),
        left: -corner.x,
        top: -corner.y,
        width: deviceX(scale, SCREEN_CONFIG.width),
      });
    },
  };
}

interface NativeClose {
  readonly element: HTMLElement;
  readonly hit: Rect;
}

export function createQuestionCardFrame(
  doc: Document,
  input: {
    readonly id: string;
    readonly panel: Rect;
    readonly title: string;
    readonly titleLines: readonly PanelText[];
    readonly actionHits: readonly Rect[];
  },
): {
  readonly actions: HTMLElement;
  readonly body: HTMLElement;
  readonly element: HTMLElement;
  readonly title: HTMLElement;
  readonly titleLines: HTMLElement;
  dispose(): void;
  place(scale: DomScale, close?: NativeClose): void;
} {
  const frame = createModalFrame(doc, {
    id: input.id,
    skinClassName: "adw-card",
    title: input.title,
  });
  // The existing full-screen dialog owns focus, dismissal and the backdrop. The card supplies
  // the skin and slots within that single modal session.
  frame.card.removeAttribute("role");
  frame.card.removeAttribute("aria-labelledby");
  frame.card.style.pointerEvents = "none";
  frame.card.style.touchAction = "auto";
  frame.body.style.touchAction = "auto";
  frame.backdrop.hidden = true;
  frame.header.classList.add("adw-panel-title");
  frame.title.textContent = "";
  const title = screenHost(doc, frame.title, "span");
  const body = screenHost(doc, frame.content);
  const actions = input.actionHits.length === 0 ? undefined : screenHost(doc, frame.footerSlot);
  const titleRow = cardTitleRow(input.panel);
  const firstCap = input.titleLines[0]?.capTop;
  const lastCap = input.titleLines.at(-1)?.capTop;
  return {
    actions: actions?.element ?? frame.footerSlot,
    body: body.element,
    dispose: () => frame.dispose(),
    element: frame.element,
    place(scale, close) {
      const box = frameRect(scale, input.panel);
      const hit = close === undefined ? undefined : gridRect(scale, close.hit);
      // Kit places the real 48px authored target. The button's own skin still paints the
      // independently snapped X face inside it, so the frame adds no pseudo-element reach.
      const corner =
        hit === undefined
          ? undefined
          : {
              height: hit.height,
              width: hit.width,
              x: box.left + box.width - hit.left - hit.width,
              y: hit.top - box.top,
            };
      const closeBottom = corner === undefined ? 0 : corner.y + corner.height;
      const actionTop = input.actionHits.reduce(
        (top, hit) => Math.min(top, gridY(scale, hit.y)),
        box.top + box.height,
      );
      const footerHeight =
        actions === undefined
          ? 0
          : Math.min(box.height - closeBottom, Math.max(1, box.top + box.height - actionTop));
      const titleRoom = box.height - footerHeight;
      const inset =
        firstCap === undefined
          ? 0
          : Math.min(Math.floor(titleRoom / 2), Math.max(0, gridY(scale, titleRow.y) - box.top));
      const titleHeight =
        firstCap === undefined || lastCap === undefined
          ? 0
          : Math.min(
              titleRoom - 2 * inset,
              gridY(scale, titleRow.y + titleRow.height) -
                gridY(scale, titleRow.y) +
                gridY(scale, lastCap) -
                gridY(scale, firstCap),
            );
      // Supply the authored art-grid box in device pixels; the outer dialog converts to CSS once.
      const layout = frame.layout(
        {
          ...(corner === undefined ? {} : { close: { face: corner, press: corner } }),
          content: { height: box.height, width: box.width, x: box.left, y: box.top },
          families: { authored: box.width },
          family: "authored",
          gap: 0,
          insets: { bottom: 0, side: 0 },
          margin: 0,
          padding: Math.min(
            Math.floor((box.width - 1) / 2),
            Math.max(0, gridX(scale, titleRow.x) - box.left),
          ),
          project: { x: (x) => x, y: (y) => y },
          variant: "card",
        },
        {
          body: titleRoom - Math.max(closeBottom, titleHeight + 2 * inset),
          ...(close === undefined ? {} : { close: close.element }),
          ...(actions === undefined ? {} : { footer: { height: footerHeight } }),
          scroll: "game",
          title: { height: titleHeight, inset },
        },
      ).frame;
      title.place(scale, layout.title);
      body.place(scale, layout.body);
      if (layout.footer !== undefined) {
        actions?.place(scale, layout.footer);
      }
    },
    title: frame.title,
    titleLines: title.element,
  };
}
