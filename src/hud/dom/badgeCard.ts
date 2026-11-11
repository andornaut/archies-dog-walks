import { domArtPath } from "../../assets/domArt.ts";
import { type BadgeCardView, CONFETTI } from "../../home/badgeCardView.ts";
import { placeFrame, setBox } from "../../ui/dom/pixelLine.ts";
import { shadePart } from "../../ui/dom/shade.ts";
import { playingFrame, sheetTagFrames, type TagFrame } from "../../ui/dom/sheetFrames.ts";
import type { UiLayer } from "../../ui/dom/uiLayer.ts";
import {
  artPixel,
  deviceX,
  deviceY,
  type DomScale,
  exactDeviceX,
  exactDeviceY,
  wholeArtPixels,
} from "../../ui/domScale.ts";
import { artPart, type DomDetailCardInput, textPart } from "./detailCard.ts";
import { type DomPart, type DomQuestionPanel, showQuestionPanel } from "./questionPanel.ts";
import { fillPart } from "./shopPage.ts";

// A badge's card in HTML over the canvas: the shade under it, the ui-panel, the close control,
// any confetti behind the badge, the badge at 2x and its name, status, goal and line, at the
// places the canvas draws them (badgeCardView). It takes no presses: a press anywhere goes
// through to the canvas, whose scene closes it.

export interface DomBadgeCardInput extends Omit<DomDetailCardInput, "close" | "view"> {
  // Calls step before every frame the game draws, until the returned stop is called.
  readonly everyFrame: (step: () => void) => () => void;
  // The scene's clock, in ms, which plays the confetti.
  readonly now: () => number;
  readonly view: BadgeCardView;
}

// Ids that tie each card's dialog to its text.
let cards = 0;

// The confetti's frames from the sheet's JSON, its tag played once from when it is drawn, a frame
// at a time as the scene's clock reaches it, or held on its still frame; each frame whole art
// pixels from the panel's snapped corner, centred on the badge.
function confettiPart(
  doc: Document,
  input: DomBadgeCardInput,
  confetti: NonNullable<BadgeCardView["confetti"]>,
): DomPart & { readonly stop: () => void } {
  const element = doc.createElement("span");
  element.className = "adw-art";
  element.setAttribute("aria-hidden", "true");
  element.style.visibility = "hidden";
  element.style.backgroundImage = `url("${input.artUrl(domArtPath("sheet", CONFETTI.key, "png"))}")`;
  const { panel } = input.view;
  const start = input.now();
  let frames: TagFrame[] = [];
  let scale: DomScale | undefined;
  let shown = -1;
  const show = () => {
    if (scale === undefined || frames.length === 0) {
      return;
    }
    const index = confetti.still
      ? Math.min(CONFETTI.stillFrame, frames.length - 1)
      : playingFrame(frames, input.now() - start);
    const frame = index === undefined ? undefined : frames[index];
    if (frame === undefined) {
      element.style.visibility = "hidden";
      return;
    }
    if (index === shown) {
      return;
    }
    shown = index ?? -1;
    const pixel = artPixel(scale) * confetti.scale;
    const width = frame.width * pixel;
    const height = frame.height * pixel;
    // Centred on the badge, whole art pixels from the panel's snapped corner, as the badge is.
    const left = deviceX(scale, panel.x);
    const top = deviceY(scale, panel.y);
    setBox(element, {
      height,
      left: left + wholeArtPixels(scale, exactDeviceX(scale, confetti.at.x) - width / 2 - left),
      top: top + wholeArtPixels(scale, exactDeviceY(scale, confetti.at.y) - height / 2 - top),
      width,
    });
    element.style.backgroundSize = `${frame.sheet.width * pixel}px ${frame.sheet.height * pixel}px`;
    element.style.backgroundPosition = `${-frame.x * pixel}px ${-frame.y * pixel}px`;
    element.style.visibility = "";
  };
  input.loadSheet(input.artUrl(domArtPath("sheet", CONFETTI.key, "json"))).then(
    (json) => {
      frames = sheetTagFrames(json, CONFETTI.tag);
      show();
    },
    (error: unknown) => console.error(`The ${CONFETTI.key} sheet did not load.`, error),
  );
  const stop = input.everyFrame(show);
  return {
    element,
    place: (at) => {
      scale = at;
      shown = -1;
      show();
    },
    stop,
  };
}

// The card in layer, shown and its dialog focused.
export function showBadgeCard(layer: UiLayer, input: DomBadgeCardInput): DomQuestionPanel {
  const doc = layer.element.ownerDocument;
  cards += 1;
  const { view } = input;
  const frame = doc.createElement("div");
  frame.className = "adw-panel";
  const texts = doc.createElement("div");
  texts.className = "adw-lines";
  texts.id = `adw-badge-${cards}`;
  const textParts = view.texts.map((text) => textPart(doc, input, text));
  texts.append(...textParts.map(({ element }) => element));
  const confetti =
    view.confetti === undefined ? undefined : confettiPart(doc, input, view.confetti);
  const parts: DomPart[] = [
    shadePart(doc, view.dim),
    { element: frame, place: (scale) => placeFrame(scale, { x: 0, y: 0 }, frame, view.panel) },
    ...(confetti === undefined ? [] : [confetti]),
    ...view.fills.map((fill) => fillPart(doc, fill)),
    ...view.art.map((art) => artPart(doc, input, art)),
    {
      element: texts,
      place: (scale) => {
        for (const part of textParts) {
          part.place(scale);
        }
      },
    },
  ];
  const shown = showQuestionPanel(layer, {
    close: undefined,
    closeLabel: input.closeLabel,
    describedBy: texts.id,
    fonts: input.fonts,
    label: view.title,
    numberKeys: false,
    parts,
    presses: [],
    toGame: input.toGame,
    view: {
      buttons: [],
      close: view.close,
      covered: [],
      frame: "none",
      note: [],
      notePlate: undefined,
      panel: view.panel,
      title: [],
      titleY: view.panel.y,
    },
  });
  return {
    ...shown,
    destroy: () => {
      confetti?.stop();
      shown.destroy();
    },
  };
}
