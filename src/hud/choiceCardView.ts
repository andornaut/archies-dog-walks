import type { Rect } from "@andornaut/game-kit/runtime/rect";
import {
  type BitmapFont,
  fontMetrics,
  inkRowsOfLines,
  laidGlyphs,
} from "@andornaut/game-kit/runtime/text/bitmapFont";
import { fittingText, type TextFitStyle } from "@andornaut/game-kit/runtime/text/textFit";

import { cardFrameTag, SKIP_CARD_ART } from "../assets/index.ts";
import type { GameData } from "../data/index.ts";
import type { DetailText } from "../home/index.ts";
import {
  CARD_LAYOUT as CARD,
  FIRES_FIT,
  largeBodyBox,
  largeBodyStyle,
  largeCardHeight,
  largeCardRect,
  plaqueRoom,
} from "../presentation/index.ts";
import {
  type CardView,
  type Choice,
  firesText,
  hasPlaque,
  type OptionView,
} from "../rules/index.ts";
import { GREYED, inkWithPills, PALETTE, plainMarks, TEXT_SCALE } from "../ui/index.ts";
import { optionMarks } from "./buffMarks.ts";
import { largeBodyText, plaqueTexts, smallCardText } from "./cardText.ts";
import { type ChoiceCharmPlate, choiceCharmStack } from "./choiceCharms.ts";

export interface ChoiceEntry {
  readonly choice: Choice;
  readonly enabled: boolean;
  readonly option?: OptionView;
}
interface ChoiceCardLabel {
  readonly colour: number;
  readonly face: Rect;
  readonly lines: readonly string[];
}
export interface ChoiceCardSurface {
  readonly attribution: string | null;
  readonly charms: readonly ChoiceCharmPlate[];
  readonly frame: { readonly key: string; readonly tag: string; readonly large: boolean };
  readonly grey: boolean;
  readonly illustration: { readonly key: string; readonly rect: Rect; readonly scale: number };
  readonly label: string;
  readonly title: ChoiceCardLabel;
  readonly marker: { readonly x: number; readonly y: number; readonly scale: number } | undefined;
  readonly paws:
    { readonly difficulty: number; readonly x: number; readonly y: number } | undefined;
  readonly plaque: (ChoiceCardLabel & { readonly rect: Rect }) | undefined;
  readonly rect: Rect;
  readonly texts: readonly DetailText[];
}
export interface ChoiceCardFonts {
  readonly body: BitmapFont;
  readonly title: BitmapFont;
}

export function choiceCardInk(
  fonts: ChoiceCardFonts,
  role: "body" | "title",
  style: TextFitStyle,
  text: string,
): number {
  const shown = role === "body" ? plainMarks(text) : plainMarks(text).toUpperCase();
  const ink = inkWithPills(
    style.scale,
    laidGlyphs(fonts[role], style.scale, shown).map((glyph) => ({ ...glyph, line: 0 })),
  );
  return ink === null ? 0 : ink.right - ink.left;
}

// Both card sizes use the existing fitted text, plaque and modifier layouts at their authored scales.
export function choiceCardSurface(
  data: GameData,
  fonts: ChoiceCardFonts,
  view: CardView,
  entry: ChoiceEntry,
  place: Rect,
  large = false,
): ChoiceCardSurface {
  const metrics = { body: fontMetrics(fonts.body), title: fontMetrics(fonts.title) };
  const ink = (role: "body" | "title") => (style: TextFitStyle, line: string) =>
    choiceCardInk(fonts, role, style, line);
  const marks = optionMarks(data, view, entry.option);
  const forgiven = marks.forgiven;
  const attribution =
    forgiven !== null &&
    marks.charms.some(({ effect, name }) => effect === null && name === forgiven.name)
      ? forgiven.name
      : null;
  const forgivenText =
    forgiven === null
      ? undefined
      : [
          ...forgiven.rows,
          ...(attribution === null && forgiven.name !== "" ? [forgiven.name] : []),
        ].join("\n");
  const charms = choiceCharmStack(fonts, large ? CARD.large.width : place.width, marks.charms);
  const texts: DetailText[] = [];
  const label = entry.option?.label ?? data.runText.card.skip;
  const grey = !large && !entry.enabled;
  const bodyColour = grey ? PALETTE[GREYED.text] : PALETTE.plum;
  const warning =
    large && entry.option !== undefined && entry.option.fires.length > 0
      ? fittingText(
          FIRES_FIT.large.style,
          ink("title"),
          FIRES_FIT.large.room,
          firesText(data, entry.option.fires),
        )
      : null;
  const bodyBox = largeBodyBox(metrics, warning?.lines.length ?? 0);
  const bodyStyle = largeBodyStyle(metrics.body, bodyBox.height, place, charms.height);
  const body = large
    ? fittingText(
        bodyStyle,
        ink("body"),
        CARD.large.body.width,
        forgivenText ?? largeBodyText(data, entry.option),
      )
    : null;
  const contentHeight =
    bodyBox.top + inkRowsOfLines(metrics.body, body?.lines.length ?? 0) * bodyStyle.scale;
  const rect = large ? largeCardRect(place, largeCardHeight(contentHeight), charms.height) : place;
  const shift = rect.height - CARD.large.height;
  const centreX = rect.x + rect.width / 2;
  const add = (
    font: "body" | "title",
    lines: readonly string[],
    capTop: number,
    scale: number,
    colour: number = bodyColour,
  ) =>
    texts.push({
      align: "inkCentreWithPills",
      capTop,
      colour,
      font,
      lines,
      scale,
      x: centreX,
    });
  const band = large ? CARD.large.band : CARD.band;
  const title: ChoiceCardLabel = {
    colour: bodyColour,
    face: {
      height: band.height,
      width: band.room,
      x: rect.x + (rect.width - band.room) / 2,
      y: rect.y + band.y,
    },
    lines: fittingText({ lines: large ? 1 : 2, scale: TEXT_SCALE }, ink("body"), band.room, label)
      .lines,
  };
  if (large) {
    const top = rect.y + CARD.large.body.y;
    if (warning !== null) {
      add("title", warning.lines, top, warning.style.scale, PALETTE.darkRed);
    }
    add(
      "body",
      body?.lines ?? [],
      top + bodyBox.top,
      bodyStyle.scale,
      forgiven === null ? PALETTE.plum : PALETTE.forest,
    );
  } else {
    const shown = smallCardText(data, metrics.body, ink("body"), entry.option, forgivenText);
    if (shown.warning !== null) {
      add(
        "body",
        shown.warning.lines,
        rect.y + shown.box.warningY,
        shown.warning.style.scale,
        grey ? bodyColour : PALETTE.darkRed,
      );
    }
    add(
      "body",
      shown.effect.lines,
      rect.y + shown.box.y,
      shown.effect.style.scale,
      forgiven === null || grey ? bodyColour : PALETTE.forest,
    );
  }
  const scale = large ? 2 : 1;
  const marker =
    (entry.option?.fires.length ?? 0) === 0
      ? undefined
      : {
          scale,
          x: rect.x + (large ? CARD.large.fires.x : CARD.fires.x),
          y: rect.y + (large ? CARD.large.fires.y + shift : CARD.fires.y),
        };
  const basePlaque = large ? CARD.large.badge : CARD.badge;
  const plaqueRect =
    hasPlaque(entry.option) || marks.plaque !== null
      ? {
          height: basePlaque.height,
          width: basePlaque.width,
          x: rect.x + basePlaque.x,
          y: rect.y + basePlaque.y + (large ? shift : 0),
        }
      : undefined;
  let plaque: ChoiceCardSurface["plaque"];
  if (plaqueRect !== undefined) {
    const edge = marker === undefined ? undefined : marker.x + CARD.fires.size * scale;
    const faceLeft = plaqueRect.x + CARD.badgeSlices.left * scale;
    const faceRight = plaqueRect.x + plaqueRect.width - CARD.badgeSlices.right * scale;
    const options =
      marks.plaque !== null
        ? [marks.plaque]
        : entry.option === undefined
          ? []
          : plaqueTexts(data, entry.option);
    const room = plaqueRoom(faceLeft, faceRight - faceLeft, edge);
    const selected =
      options.find((text) => ink("body")({ scale: TEXT_SCALE }, text) <= room) ??
      options.at(-1) ??
      "";
    // The text's ink is centred on the plaque's face, right of the marker where there is one.
    const left = Math.max(faceLeft, edge ?? faceLeft);
    plaque = {
      colour:
        marks.plaque !== null ? PALETTE.forest : grey ? PALETTE[GREYED.plateText] : PALETTE.plum,
      face: {
        height: basePlaque.face.height,
        width: faceRight - left,
        x: left,
        y: plaqueRect.y + basePlaque.face.y,
      },
      lines: [selected],
      rect: plaqueRect,
    };
  }
  return {
    attribution,
    charms: charms.place(rect),
    frame: {
      key: large ? "card-frame-large" : "card-frame",
      large,
      tag: cardFrameTag(view.source),
    },
    grey,
    illustration: {
      key: entry.option?.art ?? SKIP_CARD_ART,
      rect: {
        height: CARD.art.height * scale,
        width: CARD.art.width * scale,
        x: rect.x + (large ? CARD.large.art.x : CARD.art.x),
        y: rect.y + (large ? CARD.large.art.y : CARD.art.y),
      },
      scale,
    },
    label,
    marker,
    paws:
      large || entry.option?.path === undefined
        ? undefined
        : {
            difficulty: entry.option.path.difficulty,
            x: rect.x + rect.width / 2,
            y: rect.y + CARD.paws.y,
          },
    plaque,
    rect,
    texts,
    title,
  };
}
