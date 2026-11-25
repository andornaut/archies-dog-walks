import type { BitmapFont } from "@andornaut/game-kit/runtime/text/bitmapFont";

import type { PillColours } from "../../ui/dom/labelBlock.ts";
import type { DomPart } from "../../ui/dom/parts.ts";
import { blockPlace, setBox, shownText, spokenText } from "../../ui/dom/pixelLine.ts";
import type { DomScale } from "../../ui/domScale.ts";
import { cssHex } from "../../ui/palette.ts";
import { TEXT_SCALE } from "../../ui/textFit.ts";
import type { DetailText } from "../detailCardView.ts";

// What a detail text draws with: each font it may be set in, and the colours of a name's pill of
// a kind and of its name, or undefined for none.
export interface DetailTextInput {
  readonly fonts: Readonly<Record<NonNullable<DetailText["font"]>, BitmapFont>>;
  readonly pillColours: PillColours;
}

// A block of text: each run of a line the web font draws, each name's pill behind it, and the
// whole for a screen reader.
export function textPart(
  doc: Document,
  input: DetailTextInput,
  text: DetailText,
  // Device pixels to move it right by at a scale, as a run of a centred row (rowPart).
  shift: (scale: DomScale) => number = () => 0,
): DomPart {
  const element = doc.createElement("p");
  element.className = "adw-lines";
  if (text.focusColour !== undefined) {
    element.classList.add("adw-focus-colour");
    element.style.setProperty("--adw-focus-colour", cssHex(text.focusColour));
  }
  const font = text.font ?? "body";
  // Where each span starts in the line as the font draws it, and its colour.
  let next = 0;
  const spans = (text.spans ?? []).map((span) => {
    const from = next;
    next += [...shownText(font, span.text)].length;
    return { colour: span.colour, from };
  });
  const block = {
    ...text,
    // A left-aligned label starts its pen at x in the body font and its ink in the title font,
    // as addPixelText places it.
    anchor:
      text.align === "centre" ||
      text.align === "inkCentre" ||
      text.align === "inkRight" ||
      text.align === "right"
        ? text.align
        : font === "title"
          ? "ink"
          : "pen",
    ...(text.spans === undefined ? {} : { breaks: [new Set(spans.map(({ from }) => from))] }),
    font,
    scale: text.scale ?? TEXT_SCALE,
  } as const;
  const bitmap: BitmapFont = input.fonts[font];
  // The runs and pills are the same at every scale.
  const first = blockPlace(bitmap, { dpr: 1, origin: { x: 0, y: 0 }, unit: 1 }, block);
  const pills = first.pills.map(({ index }) => {
    const pill = doc.createElement("span");
    pill.className = "adw-pill";
    pill.setAttribute("aria-hidden", "true");
    const colours = input.pillColours(index);
    if (colours !== undefined) {
      pill.style.backgroundColor = cssHex(colours.pill);
    }
    return { colours, pill };
  });
  // Each run's colour: its pill's name colour, or the text's.
  const runs = first.runs.map((run) => {
    const span = doc.createElement("span");
    span.className = `adw-text adw-font-${font}`;
    span.setAttribute("aria-hidden", "true");
    span.textContent = run.text;
    const named = run.pill === undefined ? undefined : input.pillColours(run.pill);
    const own = spans.filter(({ from }) => from <= run.from).at(-1)?.colour;
    span.style.color = cssHex(named?.name ?? own ?? text.colour);
    return span;
  });
  const spoken = doc.createElement("span");
  spoken.className = "visually-hidden";
  spoken.textContent = `${text.lines.map((line) => spokenText(shownText(font, line))).join(" ")} `;
  element.append(...pills.map(({ pill }) => pill), ...runs, spoken);
  return {
    element,
    place: (scale) => {
      const place = blockPlace(bitmap, scale, block);
      const by = shift(scale);
      place.pills.forEach(({ box }, i) => {
        const pill = pills[i]?.pill;
        if (pill !== undefined) {
          setBox(pill, { ...box, left: box.left + by });
          pill.style.setProperty("--adw-cut", `${place.cut}px`);
        }
      });
      place.runs.forEach(({ left, top }, i) => {
        const span = runs[i];
        if (span !== undefined) {
          Object.assign(span.style, {
            fontSize: `${place.fontSize}px`,
            left: `${left + by}px`,
            lineHeight: `${place.lineHeight}px`,
            top: `${top}px`,
          });
        }
      });
    },
  };
}
