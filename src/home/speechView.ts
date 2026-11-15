import type { Rect } from "@andornaut/game-kit/rect";
import {
  advanceWidth,
  type BitmapFont,
  fontMetrics,
  laidGlyphs,
} from "@andornaut/game-kit/text/bitmapFont";

import { ownerFaceKey } from "../assets/spriteKeys.ts";
import type { DogId, GameData } from "../data/types.ts";
import { withNamePills } from "../hud/effectNames.ts";
import { plainMarks } from "../ui/pixelFont.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";
import { bubbleLines, bubbleRect, bubbleSize, ownerColumn, ownerPlace } from "./bubbleRect.ts";
import { HOME_LAYOUT } from "./homeLayout.ts";
export interface HomeSpeechView {
  readonly rect: Rect;
  readonly lines: readonly string[];
  readonly textX: number;
  readonly capTop: number;
  readonly tail?: {
    readonly key: string;
    readonly x: number;
    readonly y: number;
  };
  readonly owner?: {
    readonly dog: DogId;
    readonly key: string;
    readonly face: Rect;
    readonly name: {
      readonly text: string;
      readonly x: number;
      readonly capTop: number;
    };
  };
}
export function homeSpeechView(
  data: Pick<GameData, "debuffs" | "dogs" | "shopGear" | "upgrades" | "walkerPerks">,
  body: BitmapFont,
  tail:
    | {
        readonly key: string;
        readonly tipX: number;
      }
    | undefined,
  speech: {
    readonly owner: DogId | null;
    readonly paragraphs: readonly string[];
  },
): HomeSpeechView {
  const { petShop, speech: layout, walkerAtGate } = HOME_LAYOUT;
  const name = speech.owner === null ? undefined : data.dogs[speech.owner].owner.name;
  const nameInk =
    name === undefined
      ? []
      : laidGlyphs(body, 1, plainMarks(name)).flatMap(({ ink }) => (ink === null ? [] : [ink]));
  const column =
    nameInk.length === 0
      ? null
      : ownerColumn(
          Math.max(...nameInk.map(({ right }) => right)) -
            Math.min(...nameInk.map(({ left }) => left)),
        );
  const paragraphs = speech.paragraphs.map((line) => withNamePills(data, line));
  const measure = (line: string) => advanceWidth(body, TEXT_SCALE, plainMarks(line));
  const { faced, lines } = bubbleLines(measure, column, paragraphs);
  const widest = Math.ceil(Math.max(...lines.map(measure)));
  const size = bubbleSize(fontMetrics(body), lines, widest, faced ? column : null);
  const rect = bubbleRect(petShop.board, layout, { x: walkerAtGate.x, y: layout.top }, size);
  const place = column === null ? undefined : ownerPlace(rect, column);
  return {
    capTop: rect.y + size.textTop,
    lines,
    rect,
    textX: rect.x + layout.padX + widest / 2,
    ...(tail === undefined
      ? {}
      : {
          tail: { key: tail.key, x: walkerAtGate.x - tail.tipX, y: layout.top + size.height - 1 },
        }),
    ...(speech.owner === null || name === undefined || place === undefined
      ? {}
      : {
          owner: {
            dog: speech.owner,
            face: place.face,
            key: ownerFaceKey(data, speech.owner),
            name: { capTop: place.name.capY, text: name, x: place.name.x },
          },
        }),
  };
}
