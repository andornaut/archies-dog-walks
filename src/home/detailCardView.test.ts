import { wrapWords } from "@andornaut/game-kit/runtime/lines";
import { inkRowsOfLines } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { SCREEN_LAYOUT } from "../data/screen.ts";
import { fontFileMetrics, gameFont, inkWidth } from "../testing/fontInk.ts";
import { newPlayerSave } from "../testing/saves.ts";
import { MODAL } from "../ui/modal/layout.ts";
import { modalTitleInk } from "../ui/modal/titleRole.ts";
import { PALETTE } from "../ui/palette.ts";
import { plainMarks } from "../ui/pixelFont.ts";
import { cents } from "../units.ts";
import { dogDetail } from "./detail.ts";
import { detailCardView, type DetailMeasure, type DetailText } from "./detailCardView.ts";
import { slotRows } from "./shop.ts";

const fonts = { body: fontFileMetrics("font-body"), title: fontFileMetrics("font-title") };
const widthOf = (font: "body" | "title", text: string) =>
  inkWidth(`font-${font}`, { scale: 2 }, plainMarks(text));
const wrap = (room: number, text: string) => wrapWords((line) => widthOf("body", line), room, text);
const measure: DetailMeasure = {
  ...fonts,
  art: () => undefined,
  bodyWidth: (lines) => Math.max(0, ...lines.map((line) => widthOf("body", line))),
  hasTag: () => false,
  inkWidth: widthOf,
  titleInk: (line) => modalTitleInk(gameFont("font-title"), line),
  wrapBody: wrap,
  wrapNote: wrap,
};
const bottom = (text: DetailText) =>
  text.capTop + inkRowsOfLines(fonts[text.font ?? "body"], text.lines.length) * (text.scale ?? 2);
const card = dogDetail(gameData, newPlayerSave.owned, cents(1_000_000), "sequoia");
const picture = { key: "missing-test-portrait", scale: 1 };

it("places the owner below the portrait row, photo aligned to the dog-art column", () => {
  const view = detailCardView(gameData, measure, SCREEN_LAYOUT.screen, {
    card,
    kind: "dog",
    picture,
  });
  const [well, photo] = view.framed;
  expect(photo!.rect.x + photo!.rect.width).toBe(well!.rect.x + well!.rect.width);
  const details = view.texts.filter((text) =>
    [card.subtitle, ...card.lines].includes(text.lines.join(" ")),
  );
  expect(photo!.rect.y).toBeGreaterThan(
    Math.max(well!.rect.y + well!.rect.height, ...details.map(bottom)),
  );
  const owner = view.texts.filter((text) =>
    [card.owner!.name, card.owner!.role].includes(text.lines.join(" ")),
  );
  expect(owner.every((text) => text.x > photo!.rect.x + photo!.rect.width)).toBe(true);
  const divider = view.separators![0]!;
  expect(divider.y - Math.max(photo!.rect.y + photo!.rect.height, ...owner.map(bottom))).toBe(
    MODAL.gap + MODAL.rowGap,
  );
});

it("centres the price mark and amount together and the saving prompt as a separate full-font row", () => {
  const prompt = gameData.homeText.detail.saveUp;
  const view = detailCardView(gameData, measure, SCREEN_LAYOUT.screen, {
    card: { ...card, locked: true },
    kind: "dog",
    picture,
    statusLines: [
      { kind: "price", text: card.status },
      { kind: "status", text: prompt },
    ],
  });
  const price = view.texts.find((text) => text.font === "title")!;
  const saving = view.texts.find((text) => text.lines.join(" ") === prompt)!;
  for (const text of [price, saving]) {
    expect(text.align).toBe("inkRight");
    expect(text.x - widthOf(text.font ?? "body", text.lines[0]!) / 2).toBe(
      view.card.panel.x + view.card.panel.width / 2,
    );
    expect(text.scale ?? 2).toBe(2);
  }
  expect(price.spans!.map(({ text }) => text).join("")).toBe(card.status);
  expect(price.spans!.at(-1)!.colour).toBe(PALETTE.darkRed);
  expect(price.spans![1]).toEqual({ colour: PALETTE.forest, text: "$" });
  expect(saving.capTop - bottom(price)).toBe(MODAL.pad);
  expect(price.capTop - (view.separators![0]!.y + 1)).toBe(MODAL.gap + MODAL.rowGap);
  expect(view.card.footer!.rect.y - bottom(saving)).toBe(MODAL.pad);
});

it("uses the same card for Cancel and primary Buy, appending bank context only once", () => {
  const purchase = {
    buy: gameData.homeText.shop.confirmBuy,
    cancel: gameData.homeText.shop.confirmCancel,
    left: gameData.homeText.detail.dogStatus,
  };
  const view = detailCardView(gameData, measure, SCREEN_LAYOUT.screen, {
    card,
    kind: "dog",
    picture,
    purchase,
    statusLines: [{ kind: "price", text: card.status }],
  });
  expect(view.card.footer).toBeUndefined();
  expect(view.card.buttons.map(({ label, primary }) => [label, primary])).toEqual([
    [purchase.cancel, false],
    [purchase.buy, true],
  ]);
  const [cancel, buy] = view.card.buttons;
  expect(buy!.rect.y > cancel!.rect.y || buy!.rect.x > cancel!.rect.x).toBe(true);
  expect(view.texts.filter((text) => text.lines.join(" ") === purchase.left)).toHaveLength(1);
});

it("fits all authored dog details at full font size with separate price and saving rows", () => {
  const prompt = gameData.homeText.detail.saveUp;
  for (const dog of Object.keys(gameData.dogs) as (keyof typeof gameData.dogs)[]) {
    const info = dogDetail(gameData, newPlayerSave.owned, cents(1_000_000), dog);
    const view = detailCardView(gameData, measure, SCREEN_LAYOUT.screen, {
      card: info,
      kind: "dog",
      picture,
      statusLines: [
        { kind: "price", text: info.status },
        { kind: "status", text: prompt },
      ],
    });
    expect(view.card.panel.height, dog).toBeLessThanOrEqual(
      SCREEN_LAYOUT.screen.height - 2 * MODAL.margin,
    );
    expect(view.card.footer!.rect.y, dog).toBeGreaterThanOrEqual(
      Math.max(...view.texts.map(bottom)) + MODAL.pad,
    );
  }
});

it("keeps the slot icon and capacity without an owner or owner divider", () => {
  const slot = slotRows(gameData, newPlayerSave.owned)[0]!;
  const key = "icon-dog-slot";
  const view = detailCardView(
    gameData,
    {
      ...measure,
      art: (artKey) => (artKey === key ? { height: 32, width: 32 } : undefined),
    },
    SCREEN_LAYOUT.screen,
    {
      card: {
        lines: [slot.line],
        locked: false,
        status: gameData.homeText.shop.owned,
        subtitle: "",
        title: slot.name,
      },
      kind: "dogSlot",
      picture: { key, scale: 2 },
    },
  );
  expect(view.art.map(({ key: artKey, scale }) => [artKey, scale])).toEqual([[key, 2]]);
  expect(view.separators).toEqual([]);
  expect(view.texts.some(({ lines }) => lines.join(" ") === slot.line)).toBe(true);
  expect(view.card.footer!.label).toBe(gameData.menuText.common.close);
});
