import { advanceWidth, type BitmapFont } from "@andornaut/game-kit/text/bitmapFont";

import { domArtPath } from "../../assets/domArt.ts";
import { SLICES } from "../../data/layout.ts";
import { fillPart } from "../../hud/dom/shopPage.ts";
import { type DomArtSource, sheetArt, sheetNineSlice } from "../../ui/dom/artElements.ts";
import { createTextLine, placeText, setBox } from "../../ui/dom/pixelLine.ts";
import { artPixel, type DomScale, frameRect } from "../../ui/domScale.ts";
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
    if (source.hasArt("ui-section")) {
      const frame = sheetNineSlice(doc, source, "ui-section", SLICES["ui-section"]);
      element.append(frame.element);
      ready.push(frame.ready);
      parts.push((scale) => frame.place(scale, origin, { ...section.rect, tag: section.tag }));
    } else {
      for (const { colour, rect } of section.fallback) {
        const part = fillPart(doc, { colour: PALETTE[colour], rect });
        element.append(part.element);
        parts.push(part.place);
      }
    }
    const colour = (key: keyof typeof PALETTE) => PALETTE[key];
    const label = (
      text: string,
      x: number,
      capTop: number,
      ink: number,
      align: "left" | "right",
    ) => {
      const left =
        align === "right" ? x - advanceWidth(title, TEXT_SCALE, plainMarks(text).toUpperCase()) : x;
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
      parts.push((scale) => placeText(title, scale, origin, span, line));
    };
    label(
      section.heading.text,
      section.heading.x,
      section.heading.capTop,
      colour(section.heading.colour),
      "left",
    );
    label(
      section.note.text,
      section.note.x,
      section.note.capTop,
      colour(section.note.colour),
      "right",
    );
    if (section.id === "dogs" && snapshot.bonus !== null) {
      const { countGap, gap, heartInk, rise, scale: heartScale } = HOME_LAYOUT.bonus;
      const noteWidth = advanceWidth(
        title,
        TEXT_SCALE,
        plainMarks(section.note.text).toUpperCase(),
      );
      const countLeft = section.note.x - noteWidth;
      const heartLeft = countLeft - countGap - heartInk * heartScale;
      if (source.hasArt("ui-heart")) {
        const heart = sheetArt(doc, source, "ui-heart");
        element.append(heart.element);
        ready.push(heart.ready);
        parts.push((scale) =>
          heart.place(scale, origin, {
            scale: heartScale,
            tag: "full",
            x: heartLeft,
            y: section.note.capTop - rise,
          }),
        );
      }
      label(snapshot.bonus, heartLeft - gap, section.note.capTop, PALETTE.ink, "right");
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
      const url = source.artUrl(domArtPath("image", section.fill.key, "png"));
      fill.style.backgroundImage = `url("${url}")`;
      fill.style.backgroundRepeat = "repeat";
      ready.push(Promise.resolve([url]));
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
