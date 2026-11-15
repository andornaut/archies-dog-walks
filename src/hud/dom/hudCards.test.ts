import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { dogFaceKey } from "../../assets/spriteKeys.ts";
import { gameData } from "../../data/index.ts";
import { SCREEN_LAYOUT } from "../../data/screen.ts";
import { FakeDocument, type FakeElement, fakeLayer } from "../../testing/fakeDom.ts";
import { gameFont } from "../../testing/fontInk.ts";
import { testState } from "../../testing/runState.ts";
import { shownText } from "../../ui/dom/pixelLine.ts";
import { sheetFrame, sheetTagFrames } from "../../ui/dom/sheetFrames.ts";
import { domScale } from "../../ui/domScale.ts";
import { FEEDBACK } from "../feedback.ts";
import { DOG_CARD } from "../walkHud.ts";
import { createHudCards, type HudCardsContext } from "./hudCards.ts";

const fonts = { body: gameFont("font-body"), title: gameFont("font-title") };
const clock = (momentNow = 0, now = momentNow): HudCardsContext => ({
  momentNow,
  now,
  ownedSlots: 3,
  reducedMotion: false,
});
const json = (path: string): unknown => JSON.parse(readFileSync(`public/art/${path}`, "utf8"));
const flush = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

function fixture() {
  const doc = new FakeDocument();
  const { element, layer } = fakeLayer(doc, domScale(1, { height: 560, width: 360, x: 0, y: 0 }));
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
          (node) => node.className === "adw-spoken" && node.textContent === gameData.runText.lead,
        ),
    ).toBe(false);
    expect(
      shown[1]
        ?.all()
        .some(
          (node) => node.className === "adw-spoken" && node.textContent === gameData.runText.lead,
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
