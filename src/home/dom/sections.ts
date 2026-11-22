import { type BitmapFont, inkWidth } from "@andornaut/game-kit/runtime/text/bitmapFont";

import { SLICES } from "../../data/layout.ts";
import { fillPart } from "../../hud/dom/shopPage.ts";
import { type DomArtSource, sheetArt, sheetNineSlice } from "../../ui/dom/artElements.ts";
import { cutDomArt } from "../../ui/dom/domCuts.ts";
import { backedTextPlaces, createTextLine, placeText, setBox } from "../../ui/dom/pixelLine.ts";
import { artPixel, type DomScale, frameRect, gridX, gridY } from "../../ui/domScale.ts";
import { PALETTE } from "../../ui/palette.ts";
import { plainMarks } from "../../ui/pixelFont.ts";
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
    // A band label's ink starts at x (left) or ends at x (right), so the note's ink keeps the
    // heading's inset from the band's right edge.
    const label = (
      text: string,
      x: number,
      capTop: number,
      ink: number,
      align: "left" | "right",
    ) => {
      const left =
        align === "right" ? x - inkWidth(title, TEXT_SCALE, plainMarks(text).toUpperCase()) : x;
      const line = {
        capTop,
        centre: "left",
        centreX: left,
        colour: ink,
        font: "title",
        scale: TEXT_SCALE,
        text,
      } as const;
      const span = createTextLine(doc, line);
      element.append(span);
      return (scale: DomScale) => {
        placeText(title, scale, origin, span, line);
        const centred = backedTextPlaces(title, scale, origin, band, [line], "layout")[0]!;
        const shiftY = centred.top - Number.parseFloat(span.style.top);
        span.style.top = `${centred.top}px`;
        return shiftY;
      };
    };
    parts.push(
      label(
        section.heading.text,
        section.heading.x,
        section.heading.capTop,
        colour(section.heading.colour),
        "left",
      ),
    );
    const placeNote = label(
      section.note.text,
      section.note.x,
      section.note.capTop,
      colour(section.note.colour),
      "right",
    );
    if (section.id === "dogs" && snapshot.bonus !== null) {
      const { countGap, gap, heartInk, rise, scale: heartScale } = HOME_LAYOUT.bonus;
      const noteWidth = inkWidth(title, TEXT_SCALE, plainMarks(section.note.text).toUpperCase());
      const countLeft = section.note.x - noteWidth;
      const heartLeft = countLeft - countGap - heartInk * heartScale;
      const heart = source.hasArt("ui-heart") ? sheetArt(doc, source, "ui-heart") : undefined;
      if (heart !== undefined) {
        element.append(heart.element);
        ready.push(heart.ready);
      }
      const placeBonus = label(
        snapshot.bonus,
        heartLeft - gap,
        section.note.capTop,
        PALETTE.ink,
        "right",
      );
      parts.push((scale) => {
        const shiftY = placeNote(scale);
        const y = section.note.capTop - rise;
        heart?.place(
          scale,
          origin,
          { scale: heartScale, tag: "full", x: heartLeft, y },
          { left: gridX(scale, heartLeft), top: gridY(scale, y) + shiftY },
        );
        placeBonus(scale);
      });
    } else {
      parts.push(placeNote);
    }
  }
  for (const section of homeSectionViews(snapshot.sections)) {
    const fill = doc.createElement("div");
    fill.className = "adw-framed";
    element.append(fill);
    if ("colour" in section.fill) {
      const fillColour = PALETTE[section.fill.colour];
      fill.style.backgroundColor = `#${fillColour.toString(16).padStart(6, "0")}`;
    } else if (!source.hasArt(section.fill.key)) {
      fill.style.backgroundColor = `#${PALETTE[section.fill.fallback].toString(16).padStart(6, "0")}`;
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
