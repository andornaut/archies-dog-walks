import { type BitmapFont, inkWidth } from "@andornaut/game-kit/runtime/text/bitmapFont";

import { SLICES } from "../../data/index.ts";
import { type DomArtSource, sheetArt, sheetNineSlice } from "../../ui/dom/artElements.ts";
import { cutDomArt } from "../../ui/dom/domCuts.ts";
import { fillPart } from "../../ui/dom/parts.ts";
import {
  backedTextPlaces,
  createTextLine,
  inkEnd,
  placeText,
  setBox,
  shownText,
  textPlace,
} from "../../ui/dom/pixelLine.ts";
import {
  artPixel,
  type DomScale,
  fontPixel,
  frameRect,
  gridRect,
  gridY,
} from "../../ui/domScale.ts";
import { cssHex, PALETTE } from "../../ui/palette.ts";
import { TEXT_SCALE } from "../../ui/textFit.ts";
import { HOME_LAYOUT } from "../homeLayout.ts";
import type { Sections } from "../sections.ts";
import { homeSectionViews } from "../sectionView.ts";
export function createHomeSections(
  doc: Document,
  source: DomArtSource & {
    readonly hasArt: (key: string) => boolean;
    readonly imageSize: (key: string) => {
      readonly width: number;
      readonly height: number;
    };
  },
  title: BitmapFont,
  snapshot: {
    readonly sections: Sections;
    readonly bonus: string | null;
  },
): {
  readonly element: HTMLElement;
  readonly ready: Promise<readonly string[]>;
  place(scale: DomScale): void;
} {
  const element = doc.createElement("div");
  element.className = "adw-framed";
  const parts: ((scale: DomScale) => void)[] = [];
  const ready: Promise<readonly string[]>[] = [];
  const origin = { x: 0, y: 0 };
  for (const section of homeSectionViews(snapshot.sections)) {
    // The heading slice has equal rim rows on either side of the coloured band.
    const band = { ...section.rect, height: SLICES["ui-section"].top };
    if (source.hasArt("ui-section")) {
      const frame = sheetNineSlice(doc, source, "ui-section", SLICES["ui-section"]);
      element.append(frame.element);
      ready.push(frame.ready);
      parts.push((scale) =>
        frame.place(scale, origin, { ...section.rect, projection: "layout", tag: section.tag }),
      );
    } else {
      for (const { colour, rect } of section.fallback) {
        const part = fillPart(doc, { colour: PALETTE[colour], rect });
        element.append(part.element);
        parts.push(part.place);
      }
    }
    const colour = (key: keyof typeof PALETTE) => PALETTE[key];
    // Match the measured ink to the drawn band edges. A logical width projects differently
    // from the text's whole device glyph pixels at a fractional fit. The heading, the note and
    // the bonus are one block, its ink centred down the band; the heart follows the block.
    const label = (
      text: string,
      x: number,
      capTop: number,
      ink: number,
      align: "left" | "right",
    ) => {
      const shown = shownText("title", text);
      const last = inkEnd(title, shown);
      const width = inkWidth(title, 1, shown);
      const line = {
        capTop,
        centre: "left",
        centreX: x,
        colour: ink,
        font: "title",
        scale: TEXT_SCALE,
        text,
      } as const;
      const span = createTextLine(doc, line);
      element.append(span);
      return {
        line,
        place: (scale: DomScale, edge: number, top: number) => {
          placeText(title, scale, origin, span, line);
          const pixel = fontPixel(scale, TEXT_SCALE);
          const left = align === "left" ? edge : edge - width * pixel;
          span.style.left = `${left - (last - width) * pixel}px`;
          span.style.top = `${top}px`;
          return left;
        },
      };
    };
    const heading = label(
      section.heading.text,
      section.heading.x,
      section.heading.capTop,
      colour(section.heading.colour),
      "left",
    );
    const note = label(
      section.note.text,
      section.note.x,
      section.note.capTop,
      colour(section.note.colour),
      "right",
    );
    const bonusText = section.id === "dogs" ? snapshot.bonus : null;
    const bonus =
      bonusText === null
        ? undefined
        : label(bonusText, section.note.x, section.note.capTop, PALETTE.ink, "right");
    const heart =
      bonus !== undefined && source.hasArt("ui-heart")
        ? sheetArt(doc, source, "ui-heart")
        : undefined;
    if (heart !== undefined) {
      element.append(heart.element);
      ready.push(heart.ready);
    }
    const block = [heading, note, ...(bonus === undefined ? [] : [bonus])];
    parts.push((scale) => {
      const { left, width } = gridRect(scale, band);
      const deviceLength = (length: number) => Math.round(length * scale.unit * scale.dpr);
      const inset = deviceLength(HOME_LAYOUT.bandText.inset);
      const laid = textPlace(title, scale, origin, heading.line);
      const [centred] = backedTextPlaces(
        title,
        scale,
        origin,
        band,
        block.map(({ line }) => line),
        "layout",
      );
      const top = centred!.top;
      heading.place(scale, left + inset, top);
      const noteLeft = note.place(scale, left + width - inset, top);
      if (bonus === undefined) {
        return;
      }
      const { countGap, gap, heartInk, rise, scale: heartScale } = HOME_LAYOUT.bonus;
      const heartLeft = noteLeft - deviceLength(countGap) - heartInk * heartScale * artPixel(scale);
      const y = section.note.capTop - rise;
      heart?.place(
        scale,
        origin,
        { scale: heartScale, tag: "full", x: 0, y },
        { left: heartLeft, top: gridY(scale, y) + top - laid.top },
      );
      bonus.place(scale, heartLeft - deviceLength(gap), top);
    });
  }
  for (const section of homeSectionViews(snapshot.sections)) {
    const fill = doc.createElement("div");
    fill.className = "adw-framed";
    element.append(fill);
    if ("colour" in section.fill) {
      const fillColour = PALETTE[section.fill.colour];
      fill.style.backgroundColor = cssHex(fillColour);
    } else if (!source.hasArt(section.fill.key)) {
      fill.style.backgroundColor = cssHex(PALETTE[section.fill.fallback]);
    } else {
      // CSS repeats a whole file, so the fill is cut from its sheet.
      const { key } = section.fill;
      fill.style.backgroundRepeat = "repeat";
      ready.push(
        cutDomArt(doc, source, "image", key).then(
          (url) => {
            fill.style.backgroundImage = `url("${url}")`;
            return [url];
          },
          (error: unknown) => {
            console.error(`The ${key} fill was not cut from its sheet.`, error);
            return [];
          },
        ),
      );
    }
    parts.push((scale) => {
      setBox(fill, frameRect(scale, section.fill.rect));
      fill.style.backgroundPosition = "0px 0px";
      if ("key" in section.fill) {
        const size = source.imageSize(section.fill.key);
        const pixel = artPixel(scale);
        fill.style.backgroundSize = `${size.width * pixel}px ${size.height * pixel}px`;
      }
    });
  }
  return {
    element,
    place: (scale) => {
      for (const part of parts) {
        part(scale);
      }
    },
    ready: Promise.all(ready).then((urls) => urls.flat()),
  };
}
