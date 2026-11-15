import type { Point, Rect } from "@andornaut/game-kit/rect";
import type { BitmapFont } from "@andornaut/game-kit/text/bitmapFont";

import { badgeStripHits, type BadgeView } from "../../home/badgesView.ts";
import type { DetailArt, DetailText } from "../../home/detailCardView.ts";
import { END_LAYOUT } from "../../home/endLayout.ts";
import type { EndResults, EndScreenView } from "../../home/endScreenView.ts";
import { closeControl } from "../../ui/closeControl.ts";
import { sheetArt } from "../../ui/dom/artElements.ts";
import {
  createTextLine,
  type DomTextLine,
  placeBox,
  placeFrame,
  placeText,
} from "../../ui/dom/pixelLine.ts";
import { followModalUnderlay } from "../../ui/dom/rampDim.ts";
import type { SheetFrame } from "../../ui/dom/sheetFrames.ts";
import type { UiLayer } from "../../ui/dom/uiLayer.ts";
import { artPixel, type DomScale } from "../../ui/domScale.ts";
import { type PanelText } from "../../ui/modal/types.ts";
import { PALETTE } from "../../ui/palette.ts";
import { TEXT_SCALE } from "../../ui/textFit.ts";
import type { DomBadgeCardInput } from "./badgeCard.ts";
import { badgeStripParts } from "./celebration.ts";
import { artPart, type DomDetailCardInput, framedPart, textPart } from "./detailCard.ts";
import {
  type DomPart,
  type DomQuestionPanel,
  type DomQuestionPanelInput,
  showQuestionPanel,
} from "./questionPanel.ts";
import { fillPart } from "./shopPage.ts";

// Native results, controls and authored animation projections.

export interface DomEndScreenInput extends Pick<
  DomDetailCardInput,
  "artUrl" | "fonts" | "loadSheet" | "pillColours"
> {
  readonly badges: readonly BadgeView[];
  readonly closeLabel: string;
  readonly everyFrame: DomBadgeCardInput["everyFrame"];
  readonly gesture: NonNullable<DomQuestionPanelInput["gesture"]>;
  readonly home: () => void;
  readonly now: () => number;
  readonly openBadge: (index: number) => void;
  readonly reduced: boolean;
  readonly ribbon:
    { readonly art: DetailArt | undefined; readonly fallback: DomTextLine } | undefined;
  // The display lettering's bitmap font, which lays the title's web font out.
  readonly display: BitmapFont | undefined;
  readonly toGame: DomQuestionPanelInput["toGame"];
  readonly view: EndScreenView;
}

export interface DomEndScreen extends DomQuestionPanel {
  // Back to title pressed, or raised bob game pixels down (whole, as the canvas bobs it).
  setButton(pressed: boolean, bob: number): void;
  setFace(index: number, frame: SheetFrame | undefined, dy: number): void;
  setBadgePop(index: number, scale: number): void;
  burstBadge(index: number): void;
  setRibbon(alpha: number, dy: number): void;
}

const ORIGIN = { x: 0, y: 0 } as const;

// The display lettering's fill colour, which its bitmap font bakes in on the canvas.
const DISPLAY_FILL = PALETTE.yellow;

// The results moved down dy, as the canvas moves their group.
function moved(results: EndResults, dy: number) {
  const point = <T extends Point>(at: T): T => ({ ...at, y: at.y + dy });
  const art = (item: DetailArt): DetailArt => ({
    ...point(item),
    ...(item.centre === undefined ? {} : { centre: point(item.centre) }),
    ...(item.holder === undefined ? {} : { holder: point(item.holder) }),
    ...(item.right === undefined ? {} : { right: point(item.right) }),
  });
  const text = (item: DetailText): DetailText => ({ ...item, capTop: item.capTop + dy });
  const line = (item: PanelText): PanelText => ({ ...item, capTop: item.capTop + dy });
  return {
    art: results.art.map(art),
    band: {
      fill: point(results.band.fill),
      lip: point(results.band.lip),
      outline: point(results.band.outline),
    },
    bubbles: results.bubbles.map(point),
    faces: results.faces.map(point),
    framed: results.framed.map((box) => ({ ...box, rect: point(box.rect) })),
    names: results.names.map(line),
    panel: point(results.panel),
    rule: point(results.rule),
    texts: results.texts.map(text),
    title: { ...results.title, capTop: results.title.capTop + dy },
    wells: results.wells.map(point),
  };
}

// Lines of text in parent, each placed as the canvas places it, the whole read as written unless
// the dialog's name already reads it.
function linesPart(
  doc: Document,
  fonts: (line: DomTextLine) => BitmapFont,
  lines: readonly DomTextLine[],
  spoken = true,
): DomPart {
  const parent = doc.createElement("p");
  parent.className = "adw-lines";
  const elements = lines.map((line) => {
    const element = createTextLine(doc, line);
    element.setAttribute("aria-hidden", "true");
    parent.append(element);
    return element;
  });
  if (spoken) {
    const words = doc.createElement("span");
    words.className = "adw-spoken";
    words.textContent = lines.map(({ text }) => text).join(" ");
    parent.append(words);
  }
  return {
    element: parent,
    place: (scale) =>
      lines.forEach((line, i) => {
        const element = elements[i];
        if (element !== undefined) {
          placeText(fonts(line), scale, ORIGIN, element, line);
        }
      }),
  };
}

// A ui-quip bubble, whole art pixels wide and tall from its snapped corner.
function bubblePart(doc: Document, rect: Rect): DomPart {
  const element = doc.createElement("div");
  element.className = "adw-quip-frame";
  return { element, place: (scale) => placeFrame(scale, ORIGIN, element, rect) };
}

function panelPart(doc: Document, rect: Rect): DomPart {
  const element = doc.createElement("div");
  element.className = "adw-plate-frame";
  return { element, place: (scale) => placeFrame(scale, ORIGIN, element, rect) };
}

// Back to title: the go button's face and its label, pressed or bobbing as the scene says.
function buttonPart(
  doc: Document,
  fonts: (line: DomTextLine) => BitmapFont,
  home: () => void,
  button: EndScreenView["button"],
): DomPart & { set(pressed: boolean, bob: number): void } {
  const element = doc.createElement("button");
  element.type = "button";
  element.className = "adw-button adw-go";
  element.setAttribute("aria-label", button.text.text);
  element.addEventListener("click", (event) => {
    if (event.detail === 0) {
      home();
    }
  });
  const face = doc.createElement("span");
  face.className = "adw-face";
  const label = createTextLine(doc, button.text);
  label.setAttribute("aria-hidden", "true");
  element.append(face, label);
  let scale: DomScale | undefined;
  let shown = { bob: 0, pressed: false };
  const show = () => {
    if (shown.pressed) {
      element.setAttribute("data-pressed", "");
    } else {
      element.removeAttribute("data-pressed");
    }
    element.style.transform =
      scale === undefined || shown.bob === 0 ? "" : `translateY(${shown.bob * artPixel(scale)}px)`;
  };
  return {
    controls: [element],
    element,
    place: (at) => {
      scale = at;
      placeBox(at, ORIGIN, element, button.hit);
      placeFrame(at, button.hit, face, button.rect);
      placeText(fonts(button.text), at, button.hit, label, button.text);
      show();
    },
    set(pressed, bob) {
      if (pressed !== shown.pressed || bob !== shown.bob) {
        shown = { bob, pressed };
        show();
      }
    },
  };
}

// Native results and controls share the scene's authored models and animation clock.
export function showEndScreen(layer: UiLayer, input: DomEndScreenInput): DomEndScreen {
  const doc = layer.element.ownerDocument;
  const { view } = input;
  let accepts = () => false;
  const fonts = (line: DomTextLine) =>
    line.font === "display" ? (input.display ?? input.fonts.title) : input.fonts[line.font];
  const results = moved(view.results, view.offsetY);
  const title: DomTextLine = {
    capTop: results.title.capTop,
    centre: "advance",
    centreX: results.title.centreX,
    colour: input.display === undefined ? PALETTE.plum : DISPLAY_FILL,
    font: input.display === undefined ? "title" : "display",
    scale: input.display === undefined ? TEXT_SCALE : 1,
    text: results.title.text,
  };
  const faces = results.faces.map((face) => {
    const art = sheetArt(doc, input, face.key);
    let at: DomScale | undefined;
    let frame: SheetFrame | undefined;
    let dy = 0;
    const paint = () => {
      if (at !== undefined) {
        art.place(at, ORIGIN, {
          tag: face.fired ? "fired" : "happy",
          x: face.x,
          y: face.y + dy,
          ...(frame === undefined ? {} : { frame }),
        });
      }
    };
    return {
      part: {
        element: art.element,
        place: (scale: DomScale) => {
          at = scale;
          paint();
        },
        ready: art.ready,
      },
      set: (next: SheetFrame | undefined, offset: number) => {
        if (frame !== next || dy !== offset) {
          frame = next;
          dy = offset;
          paint();
        }
      },
    };
  });
  const strip = view.strip;
  const badges =
    strip === undefined
      ? undefined
      : badgeStripParts(doc, input, {
          badges: input.badges,
          closes: false,
          panel: strip.panel,
          reduced: input.reduced,
          rows: strip.rows,
        });
  const badgeControls = (
    strip === undefined ? [] : badgeStripHits(strip.panel, strip.rows, input.badges.length)
  ).map((rect, index): DomPart => {
    const element = doc.createElement("button");
    element.type = "button";
    element.className = "adw-button";
    element.setAttribute("aria-label", input.badges[index]?.name ?? "");
    Object.assign(element.style, {
      background: "transparent",
      border: "0",
      padding: "0",
      pointerEvents: "auto",
      position: "absolute",
    });
    element.addEventListener("click", (event) => {
      if (event.detail === 0 && accepts()) {
        input.openBadge(index);
      }
    });
    return {
      controls: [element],
      element,
      place: (scale) => placeBox(scale, ORIGIN, element, rect),
    };
  });
  const ribbonView = input.ribbon;
  const ribbon =
    ribbonView === undefined
      ? undefined
      : ribbonView.art === undefined
        ? linesPart(doc, fonts, [
            { ...ribbonView.fallback, capTop: ribbonView.fallback.capTop + view.offsetY },
          ])
        : artPart(doc, input, { ...ribbonView.art, y: ribbonView.art.y + view.offsetY });
  const button = buttonPart(
    doc,
    fonts,
    () => {
      if (accepts()) {
        input.home();
      }
    },
    view.button,
  );
  const colours = END_LAYOUT.side.band;
  const parts: DomPart[] = [
    panelPart(doc, results.panel),
    fillPart(doc, { colour: PALETTE[colours.outline], rect: results.band.outline }),
    fillPart(doc, { colour: PALETTE[colours.fill], rect: results.band.fill }),
    fillPart(doc, { colour: PALETTE[colours.lip], rect: results.band.lip }),
    fillPart(doc, { colour: PALETTE.tan, rect: results.rule }),
    ...results.wells.map((rect) => fillPart(doc, { colour: PALETTE.tan, rect })),
    ...results.bubbles.map((rect) => bubblePart(doc, rect)),
    ...results.framed.map((box) => framedPart(doc, box)),
    ...results.art.map((art) => artPart(doc, input, art)),
    ...faces.map(({ part }) => part),
    ...(ribbon === undefined ? [] : [ribbon]),
    linesPart(doc, fonts, [title], false),
    ...results.texts.map((text) => textPart(doc, input, text)),
    linesPart(doc, fonts, results.names),
    ...(badges?.parts ?? []),
    ...(strip === undefined
      ? []
      : [
          linesPart(doc, fonts, strip.title),
          ...strip.names.map((name) => textPart(doc, input, name)),
        ]),
    button,
    ...badgeControls,
  ];
  const element = doc.createElement("div");
  element.className = "adw-framed";
  element.append(...parts.map(({ element }) => element));
  let dimmed = false;
  const underlay = followModalUnderlay(
    {
      accepts: () => !dimmed && layer.input.accepts(),
      subscribe: layer.input.subscribe,
    },
    element,
  );
  const content: DomPart = {
    controls: parts.flatMap((part) => part.controls ?? []),
    element,
    place: (scale) => parts.forEach((part) => part.place(scale)),
    ready: Promise.all(parts.map((part) => part.ready ?? Promise.resolve([]))).then((urls) => {
      underlay.refresh();
      return urls.flat();
    }),
  };
  const screen = { height: 0, width: 0, x: 0, y: 0 };
  const panel = showQuestionPanel(layer, {
    close: null,
    closeLabel: input.closeLabel,
    fonts: input.fonts,
    gesture: input.gesture,
    label: results.title.text,
    modal: false,
    numberKeys: false,
    parts: [content],
    presses: [],
    toGame: input.toGame,
    view: {
      buttons: [],
      close: closeControl(screen),
      covered: [],
      frame: "none",
      note: [],
      notePlate: undefined,
      panel: screen,
      title: [],
      titleY: 0,
    },
  });
  accepts = panel.accepts;
  return {
    ...panel,
    burstBadge: (index) => badges?.burst(index),
    destroy: () => {
      accepts = () => false;
      underlay();
      badges?.destroy();
      panel.destroy();
    },
    setBadgePop: (index, scale) => badges?.setPop(index, scale),
    setButton: (pressed, bob) => button.set(pressed, bob),
    setDimmed: (value) => {
      dimmed = value;
      underlay.refresh();
    },
    setFace: (index, frame, dy) => faces[index]?.set(frame, dy),
    setRibbon: (alpha, dy) => {
      if (ribbon !== undefined) {
        ribbon.element.style.opacity = String(alpha);
        ribbon.element.style.transform = `translateY(${dy * artPixel(layer.scale())}px)`;
      }
    },
  };
}
