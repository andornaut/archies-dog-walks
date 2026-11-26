import type { Point } from "@andornaut/game-kit/runtime/rect";
import type { BitmapFont } from "@andornaut/game-kit/runtime/text/bitmapFont";

import { cssHex, type DomScale, gridX, gridY } from "../index.ts";
import {
  blockPlace,
  displayGlyphs,
  type DomTextBlock,
  setBox,
  shownText,
  spokenText,
  WEB_FONT_EM,
} from "./pixelLine.ts";

const ORIGIN = { x: 0, y: 0 };

// The colours of a name's pill of a kind and of its name, or undefined for none.
export type PillColours = (index: number) => { name: number; pill: number } | undefined;

// A block of text as the font lays it out (DomTextBlock), the colour it takes while the control
// it is on is focused or pressed, and its first line's runs of their own colours, in order.
export interface TextBlockView extends DomTextBlock {
  readonly focusColour?: number;
  readonly spans?: readonly { readonly colour: number; readonly text: string }[];
}

// What a text block draws with: each font it may be set in, the colours of a name's pill of a
// kind and of its name, whether a screen reader reads its lines from it or from the control it
// is on, and its element: a div, a paragraph of running text or a span inside a control.
export interface TextBlockInput<F extends DomTextBlock["font"]> {
  readonly fonts: Readonly<Record<F, BitmapFont>>;
  readonly pillColours: PillColours;
  readonly spoken: boolean;
  readonly tag: "div" | "p" | "span";
}

// The native interface's one text block: each run of a line the web font draws, each name's pill
// behind it, and the whole for a screen reader where it is spoken. Shared font layout
// (blockPlace) owns anchors, ink centring and name-pill bounds. update draws another view in the
// same element, as a volume's percentage changes.
export function textBlock<F extends DomTextBlock["font"]>(
  doc: Document,
  input: TextBlockInput<F>,
  first: TextBlockView & { readonly font: F },
): {
  readonly element: HTMLElement;
  readonly ready: Promise<readonly string[]>;
  // Places the block in its container, whose corner is at origin game pixels, moved right by
  // shift device pixels, as a run of a centred row.
  readonly place: (scale: DomScale, origin?: Point, shift?: number) => void;
  readonly update: (view: TextBlockView & { readonly font: F }) => void;
} {
  const element = doc.createElement(input.tag);
  element.className = "adw-lines";
  if (!input.spoken) {
    element.setAttribute("aria-hidden", "true");
  }
  let drawn = draw(doc, input, element, first);
  let key = JSON.stringify(first);
  return {
    element,
    place(scale, origin = ORIGIN, shift = 0) {
      const { bitmap, block, pills, runs } = drawn;
      const place = blockPlace(bitmap, scale, block);
      const dx = shift - gridX(scale, origin.x);
      const dy = -gridY(scale, origin.y);
      place.pills.forEach(({ box }, i) => {
        const pill = pills[i]!;
        setBox(pill, { ...box, left: box.left + dx, top: box.top + dy });
        pill.style.setProperty("--adw-cut", `${place.cut}px`);
      });
      place.runs.forEach((run, i) => {
        const span = runs[i]!;
        Object.assign(span.style, {
          fontSize: `${place.fontSize}px`,
          left: `${run.left + dx}px`,
          lineHeight: `${place.lineHeight}px`,
          top: `${run.top + dy}px`,
        });
        if (block.font === "display") {
          span.style.setProperty("--adw-k", `${place.fontSize / WEB_FONT_EM}px`);
        }
      });
    },
    ready: Promise.resolve([]),
    update(view) {
      const next = JSON.stringify(view);
      if (next !== key) {
        key = next;
        drawn = draw(doc, input, element, view);
      }
    },
  };
}

// The block's runs and pills in element, which are the same at every scale, its colours and its
// spoken text.
function draw<F extends DomTextBlock["font"]>(
  doc: Document,
  input: TextBlockInput<F>,
  element: HTMLElement,
  view: TextBlockView & { readonly font: F },
) {
  const { focusColour, spans, ...layout } = view;
  element.classList.toggle("adw-focus-colour", focusColour !== undefined);
  if (focusColour === undefined) {
    element.style.removeProperty("--adw-focus-colour");
  } else {
    element.style.setProperty("--adw-focus-colour", cssHex(focusColour));
  }
  // Where each span starts in the first line as the font draws it, and its colour.
  let next = 0;
  const starts = (spans ?? []).map((span) => {
    const from = next;
    next += [...shownText(view.font, span.text)].length;
    return { colour: span.colour, from };
  });
  const block: DomTextBlock =
    spans === undefined ? layout : { ...layout, breaks: [new Set(starts.map(({ from }) => from))] };
  const bitmap: BitmapFont = input.fonts[view.font];
  const first = blockPlace(bitmap, { dpr: 1, origin: ORIGIN, unit: 1 }, block);
  const pills = first.pills.map(({ index }) => {
    const pill = doc.createElement("span");
    pill.className = "adw-pill";
    pill.setAttribute("aria-hidden", "true");
    const colours = input.pillColours(index);
    if (colours !== undefined) {
      pill.style.backgroundColor = cssHex(colours.pill);
    }
    return pill;
  });
  // Each run's colour: its pill's name colour, its span's, or the block's.
  const runs = first.runs.map((run) => {
    const span = doc.createElement("span");
    span.className = `adw-text adw-font-${block.font}`;
    span.setAttribute("aria-hidden", "true");
    if (block.font === "display") {
      span.append(...displayGlyphs(doc, run.text));
    } else {
      span.textContent = run.text;
    }
    const named = run.pill === undefined ? undefined : input.pillColours(run.pill);
    const own = starts.filter(({ from }) => from <= run.from).at(-1)?.colour;
    span.style.color = cssHex(named?.name ?? own ?? block.colour);
    return span;
  });
  const spoken = doc.createElement("span");
  spoken.className = "visually-hidden";
  spoken.textContent = `${block.lines.map((line) => spokenText(shownText(block.font, line))).join(" ")} `;
  element.replaceChildren(...pills, ...runs, ...(input.spoken ? [spoken] : []));
  return { bitmap, block, pills, runs };
}
