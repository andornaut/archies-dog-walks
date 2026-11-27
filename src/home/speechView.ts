import type { Rect } from "@andornaut/game-kit/runtime/rect";
import {
  advanceWidth,
  type BitmapFont,
  fontMetrics,
} from "@andornaut/game-kit/runtime/text/bitmapFont";

import { ownerFaceKey } from "../assets/index.ts";
import type { DogId } from "../data/ids.ts";
import type { GameData } from "../data/index.ts";
import { withNamePills } from "../presentation/index.ts";
import { lineInk, plainMarks, TEXT_SCALE } from "../ui/index.ts";
import { bubbleLines, bubbleRect, bubbleSize, ownerColumn, ownerPlace } from "./bubbleRect.ts";
import { HOME_LAYOUT } from "./homeLayout.ts";
export interface HomeSpeechView {
  readonly rect: Rect;
  readonly lines: readonly string[];
  readonly textX: number;
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
  const nameInk = name === undefined ? null : lineInk(body, name, TEXT_SCALE);
  const column = nameInk === null ? null : ownerColumn(nameInk.right - nameInk.left);
  const paragraphs = speech.paragraphs.map((line) => withNamePills(data, line));
  const measure = (line: string) => advanceWidth(body, TEXT_SCALE, plainMarks(line));
  const { lines } = bubbleLines(measure, column, paragraphs);
  const widest = Math.ceil(Math.max(...lines.map(measure)));
  const size = bubbleSize(
    fontMetrics(body),
    lines,
    widest,
    column === null || nameInk === null
      ? null
      : { column, inkHeight: nameInk.bottom - nameInk.top },
  );
  const rect = bubbleRect(petShop.board, layout, { x: walkerAtGate.x, y: layout.top }, size);
  const place = column === null ? undefined : ownerPlace(rect, column);
  return {
    lines,
    rect,
    textX: rect.x + layout.padX + widest / 2,
    ...(tail === undefined
      ? {}
      : {
          tail: { key: tail.key, x: walkerAtGate.x - tail.tipX, y: layout.top + size.height - 1 },
        }),
    ...(speech.owner === null || name === undefined || nameInk === null || place === undefined
      ? {}
      : {
          owner: {
            dog: speech.owner,
            face: place.face,
            key: ownerFaceKey(data, speech.owner),
            name: { capTop: place.name.inkY - nameInk.top, text: name, x: place.name.x },
          },
        }),
  };
}
