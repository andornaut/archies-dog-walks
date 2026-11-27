import "../../ui/dom/buttonReset.css";
import "./choiceCards.css";

import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";
import { fontMetrics } from "@andornaut/game-kit/runtime/text/bitmapFont";
import {
  type ButtonRefusal,
  type ButtonView,
  refuseButton,
} from "@andornaut/game-kit/runtime/web/ui/dom/button";

import { cardGreyPath, DIFFICULTY_KEY } from "../../assets/index.ts";
import { CHARM, type GameData, SCREEN_CONFIG, SLICES } from "../../data/index.ts";
import { textPart } from "../../home/dom/index.ts";
import { focusDirectionForKey, menuKeyActs, sceneKeyAllowed } from "../../input/index.ts";
import { SCREEN_LAYOUT } from "../../layout/index.ts";
import { CARD_LAYOUT, cardRowIn, forkHomeRect, walkBarIconKey } from "../../presentation/index.ts";
import { type CardView, MAX_CARD_OPTIONS } from "../../rules/index.ts";
import {
  createGameButton,
  createTextLine,
  type DomArtSource,
  type DomPart,
  type DomQuestionPanel,
  type DomQuestionPanelInput,
  framelessView,
  gridBoxPart,
  imageArt,
  imageNineSlice,
  type NativeGesture,
  placeBox,
  placeText,
  refusalPlaying,
  refuse,
  registerScenePointer,
  ringPart,
  sheetArt,
  type UiLayer,
} from "../../ui/dom/index.ts";
import {
  cardHeader,
  type DomScale,
  modalTitleInk,
  PALETTE,
  panelButton,
  TEXT_SCALE,
} from "../../ui/index.ts";
import {
  charmRing,
  type ChoiceCardFonts,
  type ChoiceCardSurface,
  choiceCardSurface,
  type ChoiceEntry,
} from "../index.ts";
import type { DomDetailCardInput } from "./detailCard.ts";
import { showQuestionPanel } from "./questionPanel.ts";

const ORIGIN = { x: 0, y: 0 } as const;
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
  // Plays the option's refusal, as Enter or Space on it does.
  refuse(index: number): void;
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

// A sheet frame by its tag from at, through sheetArt: cropped, centred on at.x, or playing its
// tag's frames in a loop from now (pulse).
function sheetPart(
  doc: Document,
  source: Source,
  key: string,
  tag: string,
  at: Point,
  options: { crop?: Rect; centre?: boolean; pulse?: boolean; scale?: number } = {},
): DomPart & { destroy(): void } {
  const art = sheetArt(doc, source, key);
  const started = source.now();
  let scale: DomScale | undefined;
  const paint = () => {
    if (scale !== undefined) {
      art.place(scale, ORIGIN, {
        ...(options.crop === undefined ? {} : { crop: options.crop }),
        ...(options.centre ? { originX: 0.5 } : {}),
        ...(options.pulse ? { playMs: source.now() - started } : {}),
        projection: "layout",
        ...(options.scale === undefined ? {} : { scale: options.scale }),
        tag,
        x: at.x,
        y: at.y,
      });
    }
  };
  const stop = options.pulse ? source.everyFrame(paint) : () => {};
  return {
    destroy: stop,
    element: art.element,
    place: (value) => {
      scale = value;
      paint();
    },
    ready: art.ready,
  };
}

// A card's parts. A live small card also has a band for its refusal flash.
function surfaceParts(
  doc: Document,
  original: Source,
  surface: ChoiceCardSurface,
  refusalBand = false,
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
  if (refusalBand) {
    const band = doc.createElement("span");
    band.className = "adw-art adw-choice-refusal-band";
    band.setAttribute("aria-hidden", "true");
    const { height, room, y } = CARD_LAYOUT.band;
    all.push(
      gridBoxPart(ORIGIN, band, {
        height,
        width: room,
        x: rect.x + (rect.width - room) / 2,
        y: rect.y + y,
      }),
    );
    labels[0]?.element.classList.add("adw-choice-refusal-label");
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
    all.push(ringPart(doc, ORIGIN, charmRing(plate)));
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
  return { all, destroy: () => sprites.forEach((sprite) => sprite.destroy()) };
}

export function showChoiceCards(
  layer: UiLayer,
  input: Source & {
    // Whether the scene takes a choice or plays a refusal now, as choose checks.
    readonly accepts: () => boolean;
    readonly choose: (index: number) => void;
    readonly closeLabel: DomQuestionPanelInput["closeLabel"];
    readonly data: GameData;
    readonly entries: readonly ChoiceEntry[];
    readonly gesture?: NativeGesture;
    readonly headHome: (() => void) | null;
    readonly keyed: boolean;
    readonly picture?: boolean;
    readonly reducedMotion: () => boolean;
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
    label(input.view.title, centre + 1, header.titleTop + 1, TEXT_SCALE, PALETTE.ink, "title");
    label(input.view.title, centre, header.titleTop, TEXT_SCALE, PALETTE.white, "title");
  }
  label(input.subtitle, centre, header.subtitleTop, 1, PALETTE.white);
  // One refusal plays at a time across the options, on the option's group: it shakes the card and
  // its red phases fill the label band dark red under a white label.
  const playRefusal = (reducedMotion: boolean, group: HTMLElement) => {
    if (!small.some((part) => refusalPlaying(part.element))) {
      refuse(reducedMotion, group);
    }
  };
  const small = input.entries.map((entry, index) => {
    const surface = choiceCardSurface(input.data, input.fonts, input.view, entry, rects[index]!);
    const rendered = surfaceParts(doc, input, surface, !input.picture);
    const group = doc.createElement("div");
    group.className = "adw-choice-group";
    const name = [surface.label, ...surface.texts.slice(1).flatMap(({ lines }) => lines)].join(
      ". ",
    );
    const refusal: ButtonRefusal = {
      reducedMotion: input.reducedMotion,
      refuse: (reducedMotion) => playRefusal(reducedMotion, group),
    };
    // A picture's option is inert art; a live option is a Kit button whose pointer presses the
    // scene reads, refused while it cannot be afforded.
    const option: ButtonView | undefined = input.picture
      ? undefined
      : createGameButton(doc, {
          appearance: { className: "adw-choice-option" },
          content: { kind: "icon", name },
          getAction: () =>
            shown.accepts() && input.accepts() ? { activate: () => input.choose(index) } : null,
          getState: () => ({ availability: { kind: entry.enabled ? "available" : "refused" } }),
          refusal,
          skin: "authored",
        });
    const element = option?.element ?? doc.createElement("span");
    if (option === undefined) {
      element.className = "adw-choice-option adw-reset-button";
      element.setAttribute("aria-label", name);
      element.setAttribute("aria-disabled", String(!entry.enabled));
    }
    const releasePointer =
      option === undefined ? () => undefined : registerScenePointer(option.element);
    Object.assign(element.style, {
      pointerEvents: input.picture ? "none" : "auto",
      position: "absolute",
    });
    group.append(...rendered.all.map(({ element: part }) => part), element);
    parts.push({
      controls: option === undefined ? [] : [option.element],
      element: group,
      place: (next) => {
        rendered.all.forEach((part) => part.place(next));
        placeBox(next, ORIGIN, element, surface.rect);
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
      destroy: () => {
        rendered.destroy();
        releasePointer();
        option?.dispose();
      },
      element: group,
      option: element,
      refuse: () => {
        if (option !== undefined) {
          refuseButton(refusal, option.element);
        }
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
        const outline = doc.createElement("span");
        outline.className = "adw-art adw-choice-held-outline";
        outline.setAttribute("aria-hidden", "true");
        const placedOutline = gridBoxPart(ORIGIN, outline, surface.rect);
        group.append(...rendered.all.map(({ element }) => element), outline);
        parts.push({
          element: group,
          place: (scale) => {
            rendered.all.forEach((part) => part.place(scale));
            placedOutline.place(scale);
          },
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
  // The scene reads a pointer press that starts on an option and handles its click, so the
  // option's Kit action takes only Enter and Space.
  let onOption = false;
  const gesture: NativeGesture | undefined =
    input.gesture === undefined
      ? undefined
      : {
          ...input.gesture,
          cancel: () => {
            onOption = false;
            input.gesture?.cancel?.();
          },
          down: (event) => {
            onOption = small.some((part) => part.option.contains(event.target as Node));
            input.gesture?.down?.(event);
          },
          up: (event, cancelled) => {
            const handled = input.gesture?.up?.(event, cancelled) === true || onOption;
            onOption = false;
            return handled;
          },
        };
  const shown = showQuestionPanel(layer, {
    close: null,
    closeLabel: input.closeLabel,
    fonts: input.fonts,
    ...(gesture === undefined ? {} : { gesture }),
    label: input.view.title,
    modal: !input.picture,
    ...(input.onPaint === undefined ? {} : { onPaint: input.onPaint }),
    numberKeys: false,
    parts,
    presses: homeRect === undefined || input.headHome === null ? [] : [input.headHome],
    toGame: input.toGame,
    view: framelessView(SCREEN_LAYOUT.walkView, {
      buttons:
        homeRect === undefined
          ? []
          : [
              panelButton(
                {
                  title: fontMetrics(input.fonts.title),
                  titleInk: (line) => modalTitleInk(input.fonts.title, line),
                },
                homeRect,
                false,
                input.data.runText.homeQuestion.headHome,
              ),
            ],
    }),
  });
  const moveFocus = (event: KeyboardEvent) => {
    const direction = focusDirectionForKey(event.code);
    if (
      direction === undefined ||
      !sceneKeyAllowed(event) ||
      !menuKeyActs(event.repeat, event.code) ||
      !shown.accepts() ||
      !input.accepts()
    ) {
      return;
    }
    // The dialog owns navigation. Confirm is the native button's existing Enter/Space click.
    event.preventDefault();
    event.stopPropagation();
    if (small[0]?.element.hidden) {
      return;
    }
    const current = small.findIndex(
      ({ option }) => option === doc.activeElement && option.matches(":focus-visible"),
    );
    const step = direction === "up" || direction === "left" ? -1 : 1;
    shown.focusControl(current === -1 ? 0 : (current + step + small.length) % small.length);
  };
  if (input.picture) {
    shown.setInert(true);
  } else {
    shown.element.addEventListener("keydown", moveFocus);
  }
  return {
    ...shown,
    destroy: () => {
      shown.element.removeEventListener("keydown", moveFocus);
      small.forEach((part) => part.destroy());
      large.forEach((part) => part.destroy());
      shown.destroy();
    },
    refuse: (index) => small[index]?.refuse(),
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
  };
}
