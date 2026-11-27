import { readFileSync } from "node:fs";

import { decodePng } from "@andornaut/art-kit/build/png";
import { wrapWords } from "@andornaut/game-kit/runtime/lines";
import { keysOf } from "@andornaut/game-kit/runtime/records";
import { insetRect, rectsOverlap } from "@andornaut/game-kit/runtime/rect";
import { laidGlyphs } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import type { DogId } from "../data/types.ts";
import { withNamePills } from "../presentation/effectNames.ts";
import type { Owned } from "../save/schema.ts";
import { bodyTextWidth } from "../testing/bodyFont.ts";
import { FakeDocument, type FakeElement } from "../testing/fakeDom.ts";
import { fontFileMetrics, fontInkRows, gameFont, inkWidth } from "../testing/fontInk.ts";
import { WEB_FONT_EM } from "../ui/dom/pixelLine.ts";
import { artPixel, domScale, fontPixel, gridX, gridY } from "../ui/domScale.ts";
import { PILL_IMAGE_GAP, PILL_SPACE } from "../ui/namePills.ts";
import { plainMarks } from "../ui/pixelFont.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";
import { cents } from "../units.ts";
import {
  bubbleLines,
  bubbleRect,
  bubbleSize,
  ownerColumn,
  ownerPlace,
  speechLines,
} from "./bubbleRect.ts";
import { createHomeSpeech } from "./dom/speech.ts";
import { dogInfo, gearInfo } from "./home.ts";
import { HOME_LAYOUT, SPEECH_ROOM } from "./homeLayout.ts";
import { walkerSays } from "./homeLines.ts";
import { homeSpeechView } from "./speechView.ts";
import { tapWalker } from "./walkers.ts";

const { board } = HOME_LAYOUT.petShop;
const { walkerAtGate } = HOME_LAYOUT;
const sizes = { clearance: 2, margin: HOME_LAYOUT.speech.margin };
const top = HOME_LAYOUT.speech.top;

describe("bubbleRect", () => {
  it("keeps a bubble of any size clear of the Pet shop's board", () => {
    for (const lines of [1, 2, 3, 4, 5, 8]) {
      for (const width of [60, 120, 200]) {
        const height = lines * 12 + 6;
        const rect = bubbleRect(board, sizes, { x: walkerAtGate.x, y: top }, { height, width });
        expect(rectsOverlap(rect, board), `${lines} lines, ${width} wide`).toBe(false);
        expect(rect.x).toBeGreaterThanOrEqual(sizes.margin);
      }
    }
  });

  // Short, and ending on the row over the board's top.
  it.each([10, board.y - top])(
    "leaves a bubble %i tall, stopping above the board, where it is centred",
    (height) => {
      const rect = bubbleRect(board, sizes, { x: 180, y: top }, { height, width: 100 });
      expect(rect.x).toBe(130);
    },
  );
});

// Every speech the walker's bubble can say, and each storage or update notice, which shows alone
// in place of the speech, wraps at 2x in the body font onto the bubble's lines, and the bubble
// keeps clear of the Pet shop's board inside the screen. A parting line wraps beside its owner's
// face and name, which stay inside the bubble and clear of the text.
describe("the walker's speech", () => {
  const text = gameData.homeText;
  const body = fontFileMetrics("font-body");
  const bodyFont = gameFont("font-body");
  const dogs = keysOf(gameData.dogs);
  const gear = keysOf(gameData.shopGear);
  const walkers = keysOf(gameData.walkers);
  const none: Owned = { dogSlots: [], dogs: [], gear: [], walkers: [] };
  const all: Owned = { dogSlots: gameData.dogSlots.map((_, i) => i + 1), dogs, gear, walkers };
  // As the bubble says them, each effect's name in its pill.
  const said = (parts: string[], owner: DogId | null = null) => ({
    owner,
    parts: parts.map((part) => withNamePills(gameData, part)),
  });
  const messages = [
    ...keysOf(text.bubble).flatMap((line) =>
      walkers.map((walker) => walkerSays(gameData, line, walker)),
    ),
    text.noticePackFull,
    text.noticeSoundOff,
    text.noticeSoundOn,
    ...[none, all].flatMap((owned) => [
      ...dogs.map((dog) => dogInfo(gameData, owned, cents(0), dog)),
      ...gear.map((item) => gearInfo(gameData, owned, cents(0), item)),
      ...walkers.flatMap((walker) => {
        const tap = tapWalker(gameData, owned, null, walker);
        return tap.kind === "drop" ? [] : [tap.text];
      }),
    ]),
  ];
  const notices = [
    text.unsaved,
    text.noticeUpdateNeeded,
    text.noticeOnlineQuota,
    text.noticeOnlineUnsupported,
  ];
  // Every speech as the bubble is given it, each once: its paragraphs and the owner who says them.
  const given = [
    ...[...messages, ...notices].map((message) => ({ owner: null, paragraphs: [message] })),
    ...dogs.flatMap((dog) =>
      gameData.quips[dog].parting.map((quip) => ({ owner: dog, paragraphs: [quip] })),
    ),
  ].filter(
    (speech, i, all) =>
      all.findIndex(
        (other) =>
          other.owner === speech.owner && other.paragraphs.join() === speech.paragraphs.join(),
      ) === i,
  );
  const speeches = given.map(({ owner, paragraphs }) => said(paragraphs, owner));
  const width = (line: string) => bodyTextWidth(2, plainMarks(line));

  // A notice shows alone, so the bubble keeps clear of the walker under it.
  it.each(notices)("says the notice %j on 2 lines at most", (notice) => {
    expect(bubbleLines(width, null, [notice]).lines.length).toBeLessThanOrEqual(2);
  });
  function ownerInk(dog: DogId) {
    const text = plainMarks(gameData.dogs[dog].owner.name);
    const style = { scale: TEXT_SCALE };
    const { bottom, top } = fontInkRows("font-body", style, text);
    const width = inkWidth("font-body", style, text);
    return { column: ownerColumn(width), inkHeight: bottom - top, width };
  }
  const { padX } = HOME_LAYOUT.speech;
  const { gap } = HOME_LAYOUT.speech.owner;
  // The quip art's rim, which the owner's face and name stay inside.
  const rim = 2;

  it("says every speech inside its bubble, beside its owner, clear of the board", () => {
    const offenders = speeches.filter(({ owner, parts }) => {
      const ink = owner === null ? null : ownerInk(owner);
      const column = ink?.column ?? null;
      const { faced, lines } = bubbleLines(width, column, parts);
      const room = faced && column !== null ? SPEECH_ROOM - column - 4 : SPEECH_ROOM;
      const whole = parts.flatMap((part) => wrapWords(width, room, part));
      const widest = Math.ceil(Math.max(...lines.map(width)));
      const size = bubbleSize(body, lines, widest, ink);
      const rect = bubbleRect(board, HOME_LAYOUT.speech, { x: walkerAtGate.x, y: top }, size);
      const bubbleFits =
        lines.join("\n") === whole.join("\n") &&
        (owner === null || faced) &&
        widest <= room &&
        !rectsOverlap(rect, board) &&
        rect.x >= HOME_LAYOUT.speech.margin;
      if (!faced || column === null || ink === null) {
        return !bubbleFits;
      }
      const { face, name } = ownerPlace(rect, column);
      const nameLeft = Math.round(name.x - ink.width / 2);
      const inner = insetRect(rim, rect);
      const textRight = rect.x + padX + widest;
      return !(
        bubbleFits &&
        face.x >= textRight + gap &&
        face.x + face.width <= inner.x + inner.width &&
        face.y >= inner.y &&
        nameLeft >= textRight + gap &&
        nameLeft + ink.width <= inner.x + inner.width &&
        name.inkY + ink.inkHeight <= inner.y + inner.height &&
        rect.y + rect.height <= HOME_LAYOUT.gateBar.y
      );
    });
    expect(offenders.map(({ parts }) => parts.join(" / "))).toEqual([]);
  });

  // The rows the quip art inks at its top and bottom edges, down its middle column.
  const quip = decodePng(readFileSync("public/art/images/ui-quip.png"));
  const quipPixel = (y: number) => {
    const at = (y * quip.width + quip.width / 2) * 4;
    return Array.from(quip.data.subarray(at, at + 4)).join();
  };
  const quipInked = (row: number) => quipPixel(row) !== quipPixel(quip.height / 2);
  const rimTop = Array.from({ length: quip.height / 2 }, (_, y) => y).filter(quipInked).length;
  const rimBottom = Array.from({ length: quip.height / 2 }, (_, y) => quip.height - 1 - y).filter(
    quipInked,
  ).length;
  // The columns it inks at its left and right edges, across its middle row.
  const quipColumn = (x: number) => {
    const at = ((quip.height / 2) * quip.width + x) * 4;
    return Array.from(quip.data.subarray(at, at + 4)).join();
  };
  const sideInked = (column: number) => quipColumn(column) !== quipColumn(quip.width / 2);
  const sideLeft = Array.from({ length: quip.width / 2 }, (_, x) => x).filter(sideInked).length;
  const sideRight = Array.from({ length: quip.width / 2 }, (_, x) => quip.width - 1 - x).filter(
    sideInked,
  ).length;

  it.each(dogs)("centres %s's owner's face over their name", (dog) => {
    const ink = ownerInk(dog);
    const lines = bubbleLines(width, ink.column, [gameData.quips[dog].parting[0] ?? ""]);
    const size = bubbleSize(body, lines.lines, 100, ink);
    const rect = { ...size, x: 0, y: 0 };
    const { face, name } = ownerPlace(rect, ink.column);
    expect(Math.abs(face.x + face.width / 2 - name.x)).toBeLessThanOrEqual(0.5);
    expect(name.inkY + ink.inkHeight + HOME_LAYOUT.speech.padBottom).toBeLessThanOrEqual(
      size.height,
    );
  });

  // Each bubble as the Start screen draws it at 360 wide and DPR 2: the clear art-pixel rows of
  // cream between the quip art's rims and the text's ink, its pills' included, over and under it.
  // The cream is the quip art's, between the rims it inks.
  const fonts = { body: bodyFont, title: gameFont("font-title") };
  const scale = domScale(2, { height: 560, width: 360, x: 0, y: 0 });
  const drawn = given.map(({ owner, paragraphs }) => {
    const view = homeSpeechView(gameData, fonts.body, undefined, { owner, paragraphs });
    const doc = new FakeDocument();
    const source = {
      artUrl: (path: string) => path,
      hasArt: () => false,
      imageSize: () => ({ height: 0, width: 0 }),
      loadSheet: async () => ({}),
    };
    const speech = createHomeSpeech(
      doc as unknown as Document,
      source,
      fonts,
      () => undefined,
      view,
    );
    speech.place(scale);
    const pixel = fontPixel(scale, TEXT_SCALE);
    const px = (value: string | undefined) => Number.parseFloat(value ?? "");
    // Each line's inked boxes in device pixels, by the paragraph that draws it: its pills' and
    // its glyphs'.
    const nodes = (speech.element as unknown as FakeElement).all();
    const ownerName = nodes.find((node) => node.classList.contains("adw-speech-name"));
    const pills = nodes.filter((node) => node.classList.contains("adw-pill"));
    const box = (node: FakeElement) => ({
      bottom: px(node.style.top) + px(node.style.height),
      left: px(node.style.left),
      right: px(node.style.left) + px(node.style.width),
      top: px(node.style.top),
    });
    const lines = nodes
      .filter((node) => node.tagName.toLowerCase() === "p")
      .map((line) => [
        ...line
          .all()
          .filter((node) => node.classList.contains("adw-pill"))
          .map(box),
        ...line
          .all()
          .filter((node) => node.classList.contains("adw-text"))
          .flatMap((node) =>
            laidGlyphs(fonts.body, 1, node.textContent ?? "").flatMap(({ char, ink }) => {
              const glyph = fonts.body.glyphs.get(char);
              return ink === null || glyph === undefined || glyph.height === 0
                ? []
                : [
                    {
                      bottom: px(node.style.top) + (glyph.yOffset + glyph.height) * pixel,
                      left: px(node.style.left) + ink.left * pixel,
                      right: px(node.style.left) + ink.right * pixel,
                      top: px(node.style.top) + glyph.yOffset * pixel,
                    },
                  ];
            }),
          ),
      ]);
    const art = artPixel(scale);
    // The art-pixel rows of cream clear over and under boxes.
    const clear = (boxes: readonly { bottom: number; top: number }[]) => ({
      above: (Math.min(...boxes.map(({ top }) => top)) - gridY(scale, view.rect.y)) / art - rimTop,
      below:
        (gridY(scale, view.rect.y + view.rect.height) -
          Math.max(...boxes.map(({ bottom }) => bottom))) /
          art -
        rimBottom,
    });
    // The columns each line's ink sits across: the cream between the frame's sides, or beside an
    // owner the text's column.
    const across =
      view.owner === undefined
        ? {
            left: gridX(scale, view.rect.x) + sideLeft * art,
            right: gridX(scale, view.rect.x + view.rect.width) - sideRight * art,
          }
        : {
            left: gridX(scale, view.rect.x + padX),
            right: gridX(scale, 2 * view.textX - view.rect.x - padX),
          };
    return {
      ...clear(lines.flat()),
      // Each line's art-pixel columns clear left and right of its ink.
      columns: lines.map((boxes) => ({
        left: (Math.min(...boxes.map(({ left }) => left)) - across.left) / art,
        right: (across.right - Math.max(...boxes.map(({ right }) => right))) / art,
      })),
      lines: view.lines.length,
      name: plainMarks(view.lines.join(" ").replaceAll(PILL_SPACE, " ")),
      owner:
        view.owner === undefined
          ? null
          : {
              actual: ownerName?.style.fontSize,
              expected: `${WEB_FONT_EM * pixel}px`,
            },
      pills: pills.length === 0 ? null : clear(pills.map(box)),
    };
  });

  it("draws bubbles of 1, 2 and 3 lines", () => {
    expect(new Set(drawn.map(({ lines }) => lines))).toEqual(new Set([1, 2, 3]));
  });

  it.each(drawn)(
    "centres the ink of $name down the bubble's cream, a row clear at least, any odd row under it",
    ({ above, below }) => {
      expect(above).toBeGreaterThanOrEqual(1);
      expect(below - above).toBeGreaterThanOrEqual(0);
      expect(below - above).toBeLessThanOrEqual(1);
    },
  );

  it.each(drawn)("centres each line of $name across the bubble on its ink", ({ columns }) => {
    for (const { left, right } of columns) {
      expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
    }
  });

  it("draws parting owners at the same size as the speech", () => {
    const owners = drawn.flatMap(({ owner }) => (owner === null ? [] : [owner]));
    expect(owners.length).toBeGreaterThan(0);
    expect(owners.every(({ actual, expected }) => actual === expected)).toBe(true);
  });

  it.each(drawn.filter(({ pills }) => pills !== null))(
    "keeps the pills of $name 2 rows clear of the bubble's rim",
    ({ pills }) => {
      expect(Math.min(pills!.above, pills!.below)).toBeGreaterThanOrEqual(PILL_IMAGE_GAP);
    },
  );
});

describe("speechLines", () => {
  const chars = (line: string) => line.length;
  it.each([
    [
      ["ab", "cd"],
      ["ab", "cd"],
    ],
    [["ab cd ef"], ["ab", "cd", "ef"]],
    [
      ["ab cd", "ef gh", "ij kl"],
      ["ab", "cd", "ef", "gh", "ij", "kl"],
    ],
  ])(
    "starts each paragraph of %j on a new line and wraps at spaces, leaving none out",
    (paragraphs, lines) => {
      expect(speechLines(chars, 3, paragraphs)).toEqual(lines);
    },
  );
});
