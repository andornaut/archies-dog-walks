import { advanceWidth, laidGlyphs } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { describe, expect, it } from "vitest";

import { dogFaceKey } from "../../assets/spriteKeys.ts";
import { gameData } from "../../data/index.ts";
import { SCREEN_LAYOUT } from "../../layout/screen.ts";
import { FakeDocument, type FakeElement, fakeLayer } from "../../testing/fakeDom.ts";
import { gameFont } from "../../testing/fontInk.ts";
import { ownArtFrames } from "../../testing/ownArtFrames.ts";
import { testState } from "../../testing/runState.ts";
import { backedTextPlaces, shownText } from "../../ui/dom/pixelLine.ts";
import { sheetFrame, sheetTagFrames } from "../../ui/dom/sheetFrames.ts";
import { domScale, exactDeviceX, fontPixel, gridRect, wholeArtPixels } from "../../ui/domScale.ts";
import { TEXT_SCALE } from "../../ui/textFit.ts";
import { FEEDBACK } from "../feedback.ts";
import { DOG_CARD, dogCardEmptyFace } from "../walkHud.ts";
import { createHudCards, type HudCardsContext } from "./hudCards.ts";

const fonts = { body: gameFont("font-body"), title: gameFont("font-title") };
const clock = (momentNow = 0, now = momentNow): HudCardsContext => ({
  momentNow,
  now,
  ownedSlots: 3,
  reducedMotion: false,
});
const json = (path: string): unknown => ownArtFrames(path);
const flush = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

const scale1 = domScale(1, { height: 560, width: 360, x: 0, y: 0 });

function fixture(scale = scale1) {
  const doc = new FakeDocument();
  const { element, layer } = fakeLayer(doc, scale);
  let unlock: () => void = () => undefined;
  const decode = new Promise<void>((resolve) => {
    unlock = resolve;
  });
  Object.assign(layer, {
    reveal: (urls: readonly string[] | Promise<readonly string[]>, target: HTMLElement) => {
      let alive = true;
      target.setAttribute("data-ui-pending", "");
      return {
        cancel: () => {
          alive = false;
        },
        revealed: Promise.resolve(urls)
          .then(() => decode)
          .then(() => {
            if (alive) {
              target.removeAttribute("data-ui-pending");
            }
            return alive;
          }),
      };
    },
  });
  const requests = new Map<string, Promise<unknown>>();
  const blocked = new Map<string, () => void>();
  const delays = new Set<string>();
  const source = {
    artUrl: (path: string) => path,
    loadSheet: (path: string) => {
      let request = requests.get(path);
      if (request === undefined) {
        request = delays.has(path)
          ? new Promise<unknown>((resolve) => {
              blocked.set(path, () => resolve(json(path)));
            })
          : Promise.resolve(json(path));
        requests.set(path, request);
      }
      return request;
    },
  };
  const view = createHudCards(layer, source, fonts, gameData);
  const cards = () =>
    (element.children[0]?.children ?? [])
      .flatMap((host) => host.children)
      .filter((card) => !card.hidden && card.getAttribute("data-ui-pending") === null);
  const text = (card: FakeElement | undefined) =>
    card
      ?.all()
      .filter((node) => node.className.includes("adw-text"))
      .map((node) => node.textContent);
  return { blocked, cards, delays, element, text, unlock, view };
}

describe("native HUD cards", () => {
  it("reveals one coherent fired, walking and empty strip with the existing card placements", async () => {
    const { cards, text, unlock, view } = fixture();
    const run = testState({ archie: "fired", ginger: 2 });
    view.update(clock(), run);
    expect(cards()).toEqual([]);
    unlock();
    expect(await view.revealed).toBe(true);
    const shown = cards();
    expect(shown).toHaveLength(3);
    expect(text(shown[0])).toContain(shownText("title", gameData.dogs.archie.name));
    expect(text(shown[0])).toContain(shownText("title", gameData.runText.fired));
    expect(text(shown[2])).toContain(shownText("title", gameData.runText.empty));
    expect(
      shown[0]
        ?.all()
        .some(
          (node) =>
            node.className === "visually-hidden" && node.textContent === gameData.runText.lead,
        ),
    ).toBe(false);
    expect(
      shown[1]
        ?.all()
        .some(
          (node) =>
            node.className === "visually-hidden" && node.textContent === gameData.runText.lead,
        ),
    ).toBe(true);
    const face = shown[1]
      ?.all()
      .find((node) => node.style.backgroundImage?.includes(dogFaceKey(gameData, "ginger")));
    expect(face?.style.left).toBe(`${SCREEN_LAYOUT.dogSlots[1]!.x + DOG_CARD.dogFace.x}px`);
    const backing = shown[0]
      ?.all()
      .find((node) => node.style.backgroundImage?.includes("ui-dog-card"));
    const expected = sheetFrame(json("sprites/ui-dog-card.json"), "empty");
    expect(backing?.style.backgroundPosition).toBe(`${-expected.x}px ${-expected.y}px`);
    // Title-font captions centre their ink; each glyph's bearing is a font pixel each side, so
    // at a whole scale this is also their advance's centre.
    for (const [index, label] of [
      [0, gameData.dogs.archie.name],
      [1, gameData.dogs.ginger.name],
    ] as const) {
      const value = shownText("title", label);
      const line = shown[index]?.all().find((node) => node.textContent === value);
      const centre = SCREEN_LAYOUT.dogSlots[index]!.x + DOG_CARD.name.x;
      expect(line?.style.left).toBe(
        `${Math.round(centre - advanceWidth(fonts.title, DOG_CARD.name.scale, value) / 2)}px`,
      );
    }
    // FIRED and Empty centre their ink on the plate and the outline's face they sit on.
    const plate = DOG_CARD.firedPlate;
    const slot0 = SCREEN_LAYOUT.dogSlots[0]!;
    for (const [index, label, backing, textScale] of [
      [0, gameData.runText.fired, { ...plate, x: slot0.x + plate.x, y: slot0.y + plate.y }, 1],
      [2, gameData.runText.empty, dogCardEmptyFace(SCREEN_LAYOUT.dogSlots[2]!), TEXT_SCALE],
    ] as const) {
      const value = shownText("title", label);
      const node = shown[index]?.all().find((n) => n.textContent === value);
      const [place] = backedTextPlaces(fonts.title, scale1, { x: 0, y: 0 }, backing, [
        {
          capTop: 0,
          centre: "ink",
          centreX: 0,
          colour: 0,
          font: "title",
          scale: textScale,
          text: label,
        },
      ]);
      expect([node?.style.left, node?.style.top, node?.style.fontSize]).toEqual([
        `${place!.left}px`,
        `${place!.top}px`,
        `${place!.fontSize}px`,
      ]);
    }
    const fractionalScale = domScale(3, { height: 560, width: 575, x: 0, y: 0 });
    const fractional = fixture(fractionalScale);
    fractional.view.update(clock(), run);
    fractional.unlock();
    await fractional.view.revealed;
    const value = shownText("title", gameData.dogs.ginger.name);
    const pixel = fontPixel(fractionalScale, DOG_CARD.name.scale);
    const centre = SCREEN_LAYOUT.dogSlots[1]!.x + DOG_CARD.name.x;
    const ink = laidGlyphs(fonts.title, 1, value).flatMap(({ ink }) => (ink === null ? [] : [ink]));
    const first = Math.min(...ink.map(({ left }) => left));
    const last = Math.max(...ink.map(({ right }) => right));
    const inkLeft =
      wholeArtPixels(
        fractionalScale,
        exactDeviceX(fractionalScale, centre) - ((last - first) * pixel) / 2,
      ) -
      first * pixel;
    const caption = fractional
      .cards()[1]
      ?.all()
      .find((node) => node.textContent === value);
    expect(caption?.style.left).toBe(`${inkLeft}px`);
    fractional.view.dispose();
    view.dispose();
  });

  it("keeps a whole prior card until replacement art settles and ignores completion after disposal", async () => {
    const { blocked, cards, delays, element, text, unlock, view } = fixture();
    view.update(clock(), testState({ archie: 3 }));
    unlock();
    await view.revealed;
    const path = `sprites/${dogFaceKey(gameData, "kilo")}.json`;
    delays.add(path);
    view.update(clock(1), testState({ kilo: 3 }));
    await flush();
    expect(text(cards()[0])).toContain(shownText("title", gameData.dogs.archie.name));
    expect(text(cards()[0])).not.toContain(shownText("title", gameData.dogs.kilo.name));
    blocked.get(path)?.();
    await flush();
    expect(text(cards()[0])).toContain(shownText("title", gameData.dogs.kilo.name));
    expect(text(cards()[0])).not.toContain(shownText("title", gameData.dogs.archie.name));
    expect(cards().map((card) => card.getAttribute("data-hud-slot"))).toEqual(["0", "1", "2"]);
    const next = `sprites/${dogFaceKey(gameData, "pepe")}.json`;
    delays.add(next);
    view.update(clock(2), testState({ pepe: 3 }));
    view.dispose();
    blocked.get(next)?.();
    await flush();
    expect(element.children).toEqual([]);
  });

  it("uses a held feedback clock for the authored loss frames and restores the resting card", async () => {
    const { cards, unlock, view } = fixture();
    const run = testState({ archie: 3 });
    view.update(clock(1000), run);
    unlock();
    await view.revealed;
    const durations = sheetTagFrames(json("sprites/ui-dog-card.json"), "heart-loss").map(
      ({ durationMs }) => durationMs,
    );
    view.flashCard({ now: 1000, reducedMotion: false }, 0);
    expect(cards()[0]?.style.transform).toBe(`translateX(${FEEDBACK.heart.shakeDx[0]}px)`);
    view.update(clock(1000, 5000), run);
    expect(cards()[0]?.style.transform).toBe(`translateX(${FEEDBACK.heart.shakeDx[0]}px)`);
    view.update(clock(1000 + durations[0]!, 5100), run);
    expect(cards()[0]?.style.transform).toBe(`translateX(${FEEDBACK.heart.shakeDx[1]}px)`);
    const end = 1000 + durations.reduce((total, duration) => total + duration, 0);
    view.update(clock(end, 5200), run);
    expect(cards()[0]?.style.transform).toBe("translateX(0px)");
    view.flashCard({ now: end, reducedMotion: true }, 0);
    view.update(clock(end + durations[0]!, 5300), run);
    expect(cards()[0]?.style.transform).toBe("translateX(0px)");
  });
});

it("keeps each card frame, portrait, heart and lead tag aligned to its logical phone layout", async () => {
  await Promise.all(
    [1, 2.625].map(async (dpr) => {
      const scale = domScale(dpr, { height: 844, width: 390, x: 0, y: 0 });
      const { cards, unlock, view } = fixture(scale);
      const run = testState({ archie: 3 });
      view.update(clock(), run);
      unlock();
      await view.revealed;
      const card = cards()[0]!;
      const slot = SCREEN_LAYOUT.dogSlots[0]!;
      for (const [key, at] of [
        ["ui-dog-card", slot],
        [
          dogFaceKey(gameData, "archie"),
          { x: slot.x + DOG_CARD.dogFace.x, y: slot.y + DOG_CARD.dogFace.y },
        ],
        ["ui-heart", { x: slot.x + DOG_CARD.hearts.x, y: slot.y + DOG_CARD.hearts.y }],
      ] as const) {
        const art = card.all().find((node) => node.style.backgroundImage?.includes(`${key}.png`));
        expect(art, key).toBeDefined();
        const frame = sheetFrame(json(`sprites/${key}.json`), undefined);
        const expected = gridRect(scale, { ...at, height: frame.height, width: frame.width });
        expect(art!.style.width, key).toBe(`${expected.width}px`);
        expect(art!.style.height, key).toBe(`${expected.height}px`);
      }
      const lead = card
        .all()
        .find((node) => node.style.backgroundImage?.includes("ui-lead-tag.png"));
      const expected = gridRect(scale, {
        height: 11,
        width: 27,
        x: slot.x + DOG_CARD.lead.x,
        y: slot.y + DOG_CARD.lead.y,
      });
      expect(lead?.style).toMatchObject({
        height: `${expected.height}px`,
        left: `${expected.left}px`,
        top: `${expected.top}px`,
        width: `${expected.width}px`,
      });
      view.dispose();
    }),
  );
});

it("speaks intact owner names once while keeping their visual lines hidden", async () => {
  const { cards, unlock, view } = fixture();
  const dogs = ["kilo", "penny", "sequoia"] as const;
  view.update(clock(), testState({ kilo: 3, penny: 3, sequoia: 3 }));
  unlock();
  expect(await view.revealed).toBe(true);
  cards().forEach((card, index) => {
    const original = gameData.dogs[dogs[index]!].owner.name;
    const nodes = card.all();
    const fragments = nodes.filter((node) => node.className === "adw-text adw-font-body");
    expect(fragments).toHaveLength(1);
    expect(fragments.every((node) => node.getAttribute("aria-hidden") === "true")).toBe(true);
    expect(
      nodes.filter((node) => node.className === "visually-hidden" && node.textContent === original),
    ).toHaveLength(1);
    expect(fragments.map((node) => node.textContent).join(" ")).toBe(original);
  });
  view.dispose();
});
