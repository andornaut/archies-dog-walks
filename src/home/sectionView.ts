import { type Rect, ringRects } from "@andornaut/game-kit/runtime/rect";

import type { PALETTE } from "../ui/palette.ts";
import { HOME_LAYOUT, sectionFill } from "./homeLayout.ts";
import type { SectionId, Sections } from "./sections.ts";
export interface HomeSectionView {
  readonly id: SectionId;
  readonly rect: Rect;
  readonly tag: string;
  readonly fallback: readonly {
    readonly colour: keyof typeof PALETTE;
    readonly rect: Rect;
  }[];
  readonly heading: {
    readonly text: string;
    readonly x: number;
    readonly capTop: number;
    readonly colour: keyof typeof PALETTE;
  };
  readonly note: {
    readonly text: string;
    readonly x: number;
    readonly capTop: number;
    readonly colour: keyof typeof PALETTE;
  };
  readonly fill:
    | {
        readonly rect: Rect;
        readonly key: string;
        readonly fallback: keyof typeof PALETTE;
      }
    | {
        readonly rect: Rect;
        readonly colour: keyof typeof PALETTE;
      };
}
// Frames, bands and fills use the same authored section state as their selection controls.
export function homeSectionViews(sections: Sections): readonly HomeSectionView[] {
  const ids: readonly SectionId[] = ["walker", "dogs", "pocket"];
  return ids.map((id) => {
    const rect = HOME_LAYOUT.sections[id];
    const section = sections[id];
    const complete = section.state === "complete";
    const look = HOME_LAYOUT.sectionLooks[id];
    const { inset, y } = HOME_LAYOUT.bandText;
    const { band, edge } = HOME_LAYOUT.sectionFrame;
    const width = rect.width - edge * 2;
    return {
      fallback: [
        ...ringRects(1, rect).map((rect) => ({ colour: "plum" as const, rect })),
        {
          colour: complete ? "amber" : look.neutral,
          rect: { height: band, width, x: rect.x + edge, y: rect.y + edge },
        },
        { colour: "plum", rect: { height: 1, width, x: rect.x + edge, y: rect.y + edge + band } },
      ],
      fill: complete
        ? { colour: HOME_LAYOUT.sectionSelectedFill, rect: sectionFill(rect) }
        : { fallback: look.fill, key: HOME_LAYOUT.sectionFillKeys[id], rect: sectionFill(rect) },
      heading: {
        capTop: rect.y + y,
        colour: complete ? "ink" : look.heading,
        text: section.heading,
        x: rect.x + inset,
      },
      id,
      note: {
        capTop: rect.y + y,
        colour: complete ? "ink" : look.note,
        text: section.note,
        x: rect.x + rect.width - inset,
      },
      rect,
      tag: complete ? "complete" : look.neutralTag,
    };
  });
}
