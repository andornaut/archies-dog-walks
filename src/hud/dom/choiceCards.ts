import "./choiceCards.css";

import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";
import { fontMetrics } from "@andornaut/game-kit/runtime/text/bitmapFont";

import { cardGreyPath } from "../../assets/cardArt.ts";
import { domArtPath } from "../../assets/domArt.ts";
import { DIFFICULTY_KEY } from "../../assets/spriteKeys.ts";
import { SLICES } from "../../data/layout.ts";
import { SCREEN_CONFIG, SCREEN_LAYOUT } from "../../data/screen.ts";
import type { GameData } from "../../data/types.ts";
import { CHARM } from "../../layout/buffLayout.ts";
import { CARD_LAYOUT, cardRowIn, forkHomeRect } from "../../layout/cardLayout.ts";
import { type CardView, MAX_CARD_OPTIONS } from "../../rules/choices.ts";
import { cardHeader } from "../../ui/cardRow.ts";
import { closeControl } from "../../ui/closeControl.ts";
import { bindGameAction } from "../../ui/dom/actionBinding.ts";
import { type DomArtSource, imageArt, imageNineSlice } from "../../ui/dom/artElements.ts";
import { type NativeGesture } from "../../ui/dom/modalLifecycle.ts";
import { createTextLine, placeBox, placeText, setBox } from "../../ui/dom/pixelLine.ts";
import { playingFrame, sheetTagFrames, type TagFrame } from "../../ui/dom/sheetFrames.ts";
import type { UiLayer } from "../../ui/dom/uiLayer.ts";
import { artPixel, type DomScale, gridRect } from "../../ui/domScale.ts";
import { panelButton } from "../../ui/modal/view.ts";
import { PALETTE } from "../../ui/palette.ts";
import {
  type ChoiceCardFonts,
  type ChoiceCardSurface,
  choiceCardSurface,
  type ChoiceEntry,
} from "../choiceCardView.ts";
import { walkBarIconKey } from "../effectIcons.ts";
import { type DomDetailCardInput, textPart } from "./detailCard.ts";
import { type DomPart, type DomQuestionPanel, showQuestionPanel } from "./questionPanel.ts";

const ORIGIN = { x: 0, y: 0 } as const;
const colour = (value: number) => `#${value.toString(16).padStart(6, "0")}`;
interface Source extends Pick<DomDetailCardInput, "artUrl" | "loadSheet" | "pillColours"> {
  readonly fonts: ChoiceCardFonts & {
    readonly display?: import("@andornaut/game-kit/runtime/text/bitmapFont").BitmapFont;
  };
  readonly everyFrame: (step: () => void) => () => void;
  readonly now: () => number;
  readonly reduced: boolean;
  readonly onPaint?: () => void;
  readonly imageSize: (key: string) => { width: number; height: number };
}
export interface NativeChoiceCards extends DomQuestionPanel {
  setLarge(index: number | undefined): void;
  setPressed(index: number | undefined): void;
  setRefusal(index: number, offset: number, red: boolean): void;
}

function imagePart(doc: Document, source: DomArtSource, key: string, rect: Rect): DomPart {
  const image = imageArt(doc, source, key);
  return {
    element: image.element,
    place: (scale) => {
      image.place(scale, ORIGIN, rect);
      placeBox(scale, ORIGIN, image.element, rect);
    },
    ready: image.ready,
  };
}

function sheetPart(
  doc: Document,
  source: Source,
  key: string,
  tag: string,
  at: Point,
  options: { crop?: Rect; centre?: boolean; pulse?: boolean; scale?: number } = {},
): DomPart & { destroy(): void } {
  const element = doc.createElement("span");
  element.className = "adw-art";
  element.style.backgroundImage = `url("${source.artUrl(domArtPath("sheet", key, "png"))}")`;
  const urls = [source.artUrl(domArtPath("sheet", key, "png"))];
  let frames: TagFrame[] = [];
  let scale: DomScale | undefined;
  const started = source.now();
  const paint = () => {
    if (scale === undefined || frames.length === 0) {
      return;
    }
    const total = frames.reduce((sum, frame) => sum + frame.durationMs, 0);
    const index =
      options.pulse && total > 0
        ? (playingFrame(frames, (source.now() - started) % total) ?? 0)
        : 0;
    const frame = frames[index]!;
    const factor = options.scale ?? 1;
    const crop = options.crop ?? { height: frame.height, width: frame.width, x: 0, y: 0 };
    const box = gridRect(scale, {
      height: crop.height * factor,
      width: crop.width * factor,
      x: at.x - (options.centre ? (frame.width * factor) / 2 : 0),
      y: at.y,
    });
    const across = box.width / crop.width;
    const down = box.height / crop.height;
    setBox(element, box);
    element.style.backgroundSize = `${frame.sheet.width * across}px ${frame.sheet.height * down}px`;
    element.style.backgroundPosition = `${-(frame.x + crop.x) * across}px ${-(frame.y + crop.y) * down}px`;
  };
  const ready = source.loadSheet(source.artUrl(domArtPath("sheet", key, "json"))).then((json) => {
    frames = sheetTagFrames(json, tag);
    paint();
    return urls;
  });
  const stop = options.pulse ? source.everyFrame(paint) : () => {};
  return {
    destroy: stop,
    element,
    place: (value) => {
      scale = value;
      paint();
    },
    ready,
  };
}

function surfaceParts(
  doc: Document,
  original: Source,
  surface: ChoiceCardSurface,
  pressCue = false,
) {
  const source: Source = surface.grey
    ? { ...original, artUrl: (path) => original.artUrl(cardGreyPath(path)) }
    : original;
  const { frame, rect } = surface;
  const all: DomPart[] = [];
  const sprites: { destroy(): void }[] = [];
  const sheet = (
    key: string,
    tag: string,
    point: Point,
    options?: Parameters<typeof sheetPart>[5],
  ) => {
    const part = sheetPart(doc, source, key, tag, point, options);
    all.push(part);
    sprites.push(part);
  };
  if (!frame.large) {
    sheet(frame.key, frame.tag, rect);
  } else {
    const { body, height, width } = CARD_LAYOUT.large;
    const foot = height - body.y - body.height;
    sheet(frame.key, frame.tag, rect, {
      crop: { height: Math.min(rect.height, height) - foot, width, x: 0, y: 0 },
    });
    for (let grown = 0; grown < rect.height - height; grown += body.height) {
      sheet(
        frame.key,
        frame.tag,
        { x: rect.x, y: rect.y + body.y + body.height + grown },
        {
          crop: {
            height: Math.min(body.height, rect.height - height - grown),
            width,
            x: 0,
            y: body.y,
          },
        },
      );
    }
    sheet(
      frame.key,
      frame.tag,
      { x: rect.x, y: rect.y + rect.height - foot },
      { crop: { height: foot, width, x: 0, y: height - foot } },
    );
  }
  all.push(imagePart(doc, source, surface.illustration.key, surface.illustration.rect));
  if (surface.plaque !== undefined) {
    all.push(imagePart(doc, source, "card-cost", surface.plaque));
  }
  if (surface.marker !== undefined) {
    sheet("ui-fires", surface.grey || original.reduced ? "static" : "pulse", surface.marker, {
      pulse: !surface.grey && !original.reduced,
      scale: surface.marker.scale,
    });
  }
  if (surface.paws !== undefined) {
    const paws = sheetPart(
      doc,
      original,
      DIFFICULTY_KEY,
      String(surface.paws.difficulty),
      surface.paws,
      { centre: true },
    );
    all.push(paws);
    sprites.push(paws);
  }
  const labels = surface.texts.map((text) =>
    textPart(
      doc,
      surface.grey
        ? { ...original, pillColours: () => ({ name: text.colour, pill: PALETTE.neutralGrey }) }
        : original,
      text,
    ),
  );
  if (pressCue) {
    const band = doc.createElement("span");
    band.className = "adw-art adw-choice-press-band";
    band.setAttribute("aria-hidden", "true");
    const { height, room, y } = CARD_LAYOUT.band;
    all.push({
      element: band,
      place: (scale) =>
        placeBox(scale, ORIGIN, band, {
          height,
          width: room,
          x: rect.x + (rect.width - room) / 2,
          y: rect.y + y,
        }),
    });
    labels[0]?.element.classList.add("adw-choice-press-label");
  }
  all.push(...labels);
  for (const { charm, rect: plate } of surface.charms) {
    const well = imageNineSlice(
      doc,
      original,
      "ui-effect-well",
      original.imageSize("ui-effect-well"),
      SLICES["ui-effect-well"],
    );
    all.push({
      element: well.element,
      place: (scale) => well.place(scale, ORIGIN, plate),
      ready: well.ready,
    });
    const ring = doc.createElement("span");
    ring.className = "adw-art";
    ring.style.borderStyle = "solid";
    ring.style.borderColor = colour(PALETTE.amber);
    all.push({
      element: ring,
      place: (scale) => {
        placeBox(scale, ORIGIN, ring, {
          height: plate.height + 2 * CHARM.ring,
          width: plate.width + 2 * CHARM.ring,
          x: plate.x - CHARM.ring,
          y: plate.y - CHARM.ring,
        });
        ring.style.borderWidth = `${CHARM.ring * artPixel(scale)}px`;
      },
    });
    all.push(
      imagePart(doc, original, walkBarIconKey(charm.item), {
        height: CHARM.size - 2 * CHARM.icon,
        width: CHARM.size - 2 * CHARM.icon,
        x: plate.x + CHARM.icon,
        y: plate.y + CHARM.icon,
      }),
    );
    all.push(
      textPart(doc, original, {
        capTop: plate.y + CHARM.card.nameY,
        colour: PALETTE.cream,
        lines: [charm.name],
        scale: 1,
        x: plate.x + CHARM.size + CHARM.card.textX,
      }),
    );
    if (charm.effect !== null) {
      all.push(
        textPart(doc, original, {
          capTop: plate.y + CHARM.card.effectY,
          colour: PALETTE.amber,
          font: "title",
          lines: [charm.effect],
          scale: 1,
          x: plate.x + CHARM.size + CHARM.card.textX,
        }),
      );
    }
  }
  const plaque = surface.plaqueText === undefined ? undefined : labels[surface.plaqueText]?.element;
  const saved = new Map<HTMLElement, string>();
  const flash = (red: boolean) => {
    if (plaque === undefined) {
      return;
    }
    const walk = (node: HTMLElement) => {
      if (!saved.has(node)) {
        saved.set(node, node.style.color);
      }
      node.style.color = red ? colour(PALETTE.red) : saved.get(node)!;
      for (const child of node.children) {
        walk(child as HTMLElement);
      }
    };
    walk(plaque);
  };
  return { all, destroy: () => sprites.forEach((sprite) => sprite.destroy()), flash };
}

export function showChoiceCards(
  layer: UiLayer,
  input: Source & {
    readonly choose: (index: number) => void;
    readonly closeLabel: string;
    readonly data: GameData;
    readonly entries: readonly ChoiceEntry[];
    readonly gesture?: NativeGesture;
    readonly headHome: (() => void) | null;
    readonly keyed: boolean;
    readonly picture?: boolean;
    readonly subtitle: string;
    readonly toGame: (client: Point) => Point;
    readonly view: CardView;
  },
): NativeChoiceCards {
  const doc = layer.element.ownerDocument;
  const rects = cardRowIn(SCREEN_LAYOUT.walkView, MAX_CARD_OPTIONS, input.entries.length);
  const header = cardHeader(input.keyed, rects);
  const parts: DomPart[] = [];
  const headerParts: HTMLElement[] = [];
  const band = imageNineSlice(
    doc,
    input,
    "ui-strip-well",
    input.imageSize("ui-strip-well"),
    SLICES["ui-strip-well"],
  );
  parts.push({
    element: band.element,
    place: (scale) => band.place(scale, ORIGIN, header.band),
    ready: band.ready,
  });
  headerParts.push(band.element);
  const label = (
    text: string,
    x: number,
    capTop: number,
    size: number,
    fill: number,
    role: "body" | "title" = "body",
  ) => {
    const part = textPart(doc, input, {
      align: "centre",
      capTop,
      colour: fill,
      font: role,
      lines: [text],
      scale: size,
      x,
    });
    parts.push(part);
    headerParts.push(part.element);
  };
  const centre = SCREEN_CONFIG.width / 2;
  const display = input.fonts.display;
  if (input.view.source.kind === "fork" && display !== undefined) {
    const line = {
      capTop: header.titleTop,
      centre: "advance",
      centreX: centre,
      colour: PALETTE.white,
      font: "display",
      scale: 1,
      text: input.view.title,
    } as const;
    const element = createTextLine(doc, line);
    parts.push({ element, place: (scale) => placeText(display, scale, ORIGIN, element, line) });
    headerParts.push(element);
  } else {
    label(input.view.title, centre + 1, header.titleTop + 1, 2, PALETTE.ink, "title");
    label(input.view.title, centre, header.titleTop, 2, PALETTE.white, "title");
  }
  label(input.subtitle, centre, header.subtitleTop, 1, PALETTE.white);
  const small = input.entries.map((entry, index) => {
    const surface = choiceCardSurface(input.data, input.fonts, input.view, entry, rects[index]!);
    const rendered = surfaceParts(doc, input, surface, !input.picture && entry.enabled);
    const group = doc.createElement("div");
    group.className = "adw-choice-group";
    const button = doc.createElement(input.picture ? "span" : "button");
    Object.assign(button.style, {
      appearance: "none",
      background: "transparent",
      border: "0",
      cursor: "pointer",
      padding: "0",
      pointerEvents: input.picture ? "none" : "auto",
      position: "absolute",
    });
    button.setAttribute(
      "aria-label",
      [surface.label, ...surface.texts.slice(1).flatMap(({ lines }) => lines)].join(". "),
    );
    button.setAttribute("aria-disabled", String(!entry.enabled));
    if (!input.picture) {
      bindGameAction(
        {
          activate: () => input.choose(index),
          available: () => shown.accepts(),
          hold: { external: "choice-preview" },
          pointer: "release",
        },
        button,
      );
    }
    let offset = 0;
    let scale = layer.scale();
    const motion = () => {
      group.style.transform = `translateX(${Math.round(offset) * artPixel(scale)}px)`;
    };
    group.append(...rendered.all.map(({ element }) => element), button);
    parts.push({
      controls: input.picture ? [] : [button],
      element: group,
      place: (next) => {
        scale = next;
        rendered.all.forEach((part) => part.place(next));
        placeBox(next, ORIGIN, button, surface.rect);
        motion();
      },
      ready: Promise.all(
        rendered.all.flatMap((part) => (part.ready === undefined ? [] : [part.ready])),
      ).then((urls) => urls.flat()),
    });
    if (input.keyed) {
      label(
        String(index + 1),
        surface.rect.x + surface.rect.width / 2,
        header.keyTop,
        1,
        PALETTE.amber,
      );
    }
    return {
      ...rendered,
      element: group,
      motion: (value: number, red: boolean) => {
        offset = value;
        motion();
        rendered.flash(red);
      },
    };
  });
  const large = input.picture
    ? []
    : input.entries.map((entry) => {
        const surface = choiceCardSurface(
          input.data,
          input.fonts,
          input.view,
          entry,
          SCREEN_LAYOUT.walkView,
          true,
        );
        const rendered = surfaceParts(doc, input, surface);
        const group = doc.createElement("div");
        group.hidden = true;
        group.append(...rendered.all.map(({ element }) => element));
        parts.push({
          element: group,
          place: (scale) => rendered.all.forEach((part) => part.place(scale)),
          ready: Promise.all(
            rendered.all.flatMap((part) => (part.ready === undefined ? [] : [part.ready])),
          ).then((urls) => urls.flat()),
        });
        return { ...rendered, element: group };
      });
  const homeRect =
    input.view.source.kind === "fork" && input.headHome !== null
      ? forkHomeRect(rects[0]!, centre)
      : undefined;
  const shown = showQuestionPanel(layer, {
    close: null,
    closeLabel: input.closeLabel,
    fonts: input.fonts,
    ...(input.gesture === undefined ? {} : { gesture: input.gesture }),
    label: input.view.title,
    modal: !input.picture,
    ...(input.onPaint === undefined ? {} : { onPaint: input.onPaint }),
    numberKeys: false,
    parts,
    presses: homeRect === undefined || input.headHome === null ? [] : [input.headHome],
    toGame: input.toGame,
    view: {
      buttons:
        homeRect === undefined
          ? []
          : [
              panelButton(
                { title: fontMetrics(input.fonts.title) },
                homeRect,
                false,
                input.data.runText.homeQuestion.headHome,
              ),
            ],
      close: closeControl(SCREEN_LAYOUT.walkView),
      covered: [],
      frame: "none",
      note: [],
      notePlate: undefined,
      panel: SCREEN_LAYOUT.walkView,
      title: [],
      titleY: 0,
    },
  });
  if (input.picture) {
    shown.setInert(true);
  }
  return {
    ...shown,
    destroy: () => {
      small.forEach((part) => part.destroy());
      large.forEach((part) => part.destroy());
      shown.destroy();
    },
    setLarge: (index) => {
      small.forEach((part) => {
        part.element.hidden = index !== undefined;
      });
      headerParts.forEach((part) => {
        part.hidden = index !== undefined;
      });
      shown.setActionShown(0, index === undefined);
      large.forEach((part, i) => {
        part.element.hidden = index !== i;
      });
    },
    setPressed: (index) =>
      small.forEach((part, i) => {
        part.element.classList.toggle("adw-choice-pressed", index === i);
      }),
    setRefusal: (index, offset, red) => small[index]?.motion(offset, red),
  };
}
