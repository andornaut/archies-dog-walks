import { domArtPath } from "../../assets/index.ts";
import { textPart } from "../../home/dom/index.ts";
import { type BadgeCardView, CONFETTI } from "../../home/index.ts";
import {
  type DomPart,
  type DomQuestionPanel,
  fillPart,
  framelessView,
  panelFramePart,
  playingFrame,
  setBox,
  sheetTagFrames,
  type TagFrame,
  type UiLayer,
} from "../../ui/dom/index.ts";
import {
  artPixel,
  type DomScale,
  exactDeviceX,
  exactDeviceY,
  gridX,
  gridY,
  wholeArtPixels,
} from "../../ui/index.ts";
import { artPart, type DomDetailCardInput } from "./detailCard.ts";
import { showQuestionPanel } from "./questionPanel.ts";

// A badge's card in HTML over the canvas: the ui-panel and close control,
// any confetti behind the badge, the badge at 2x and its name, status, goal and line, at the
// places the canvas draws them (badgeCardView). It takes no presses: a press anywhere goes
// through to the canvas, whose scene closes it.

export interface DomBadgeCardInput extends Omit<
  DomDetailCardInput,
  "backgroundCancel" | "close" | "dismiss" | "view"
> {
  // Calls step before every frame the game draws, until the returned stop is called.
  readonly dismiss?: () => void;
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
export function confettiPart(
  doc: Document,
  input: Pick<DomBadgeCardInput, "artUrl" | "everyFrame" | "loadSheet" | "now">,
  panel: BadgeCardView["panel"],
  confetti: NonNullable<BadgeCardView["confetti"]>,
  startsAt = input.now(),
): DomPart & { start(at?: number): void; readonly stop: () => void } {
  const element = doc.createElement("span");
  element.className = "adw-art";
  element.setAttribute("aria-hidden", "true");
  element.style.visibility = "hidden";
  element.style.backgroundImage = `url("${input.artUrl(domArtPath("sheet", CONFETTI.key, "png"))}")`;
  let start = startsAt;
  let frames: TagFrame[] = [];
  let scale: DomScale | undefined;
  let shown = -1;
  const show = () => {
    if (scale === undefined || frames.length === 0 || input.now() < start) {
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
    const left = gridX(scale, panel.x);
    const top = gridY(scale, panel.y);
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
  const ready = input
    .loadSheet(input.artUrl(domArtPath("sheet", CONFETTI.key, "json")))
    .then(
      (json) => {
        frames = sheetTagFrames(json, CONFETTI.tag);
        show();
      },
      (error: unknown) => console.error(`The ${CONFETTI.key} sheet did not load.`, error),
    )
    .then(() => [input.artUrl(domArtPath("sheet", CONFETTI.key, "png"))]);
  const stop = input.everyFrame(show);
  return {
    element,
    place: (at) => {
      scale = at;
      shown = -1;
      show();
    },
    ready,
    start: (at = input.now()) => {
      start = at;
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
  const texts = doc.createElement("div");
  texts.className = "adw-lines";
  texts.id = `adw-badge-${cards}`;
  const textParts = view.texts.map((text) => textPart(doc, input, text));
  texts.append(...textParts.map(({ element }) => element));
  const confetti =
    view.confetti === undefined ? undefined : confettiPart(doc, input, view.panel, view.confetti);
  const parts: DomPart[] = [
    panelFramePart(doc, "panel", view.panel),
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
    close: input.dismiss ?? null,
    ...(input.dismiss === undefined
      ? {}
      : { backgroundCancel: input.dismiss, dismiss: input.dismiss }),
    closeLabel: input.closeLabel,
    describedBy: texts.id,
    fonts: input.fonts,
    label: view.title,
    numberKeys: false,
    parts,
    presses: [],
    toGame: input.toGame,
    view: framelessView(view.panel, {
      close: view.close,
      ...(view.footer === undefined ? {} : { footer: view.footer }),
    }),
  });
  return {
    ...shown,
    destroy: () => {
      confetti?.stop();
      shown.destroy();
    },
  };
}
