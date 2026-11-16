import { animationKey } from "@andornaut/game-kit/runtime/art/aseprite";
import { expect, it, vi } from "vitest";

import { FakeDocument, fakeLayer } from "../../testing/fakeDom.ts";
import { followModalUnderlay } from "../../ui/dom/rampDim.ts";
import { domScale } from "../../ui/domScale.ts";
import { PALETTE } from "../../ui/palette.ts";
import { coverHelpUnderlay } from "./helpUnderlay.ts";
import type { HudCards } from "./hudCards.ts";
import type { HudMoment, HudMomentPainter, MomentArt } from "./hudMoments.ts";
import { projectHudCards, projectHudMoments } from "./hudProjection.ts";
it("projects one logical moment into two passive strips without duplicating its completion", () => {
  const makeSurface = () => {
    const art: MomentArt[] = [];
    const node = {
      art: vi.fn((value: MomentArt) => {
        art.push(value);
        return { dispose: vi.fn(), ready: Promise.resolve([]) };
      }),
      dispose: vi.fn(),
      state: { alpha: 1, scale: 1, visible: true, x: 0, y: 0 },
    } as unknown as HudMoment;
    const painter = {
      dispose: vi.fn(),
      group: vi.fn(() => node),
      update: vi.fn(),
    } as unknown as HudMomentPainter;
    return { art, node, painter };
  };
  const first = makeSurface(),
    second = makeSurface();
  const projection = projectHudMoments([first.painter, second.painter], {
    [animationKey("fx-heart-loss", "pop")]: 1,
  });
  const group = projection.group(60);
  const completed = vi.fn();
  group.art({ at: { x: 180, y: 300 }, key: "fx-heart-loss", onComplete: completed, tags: ["pop"] });
  expect(first.art[0]).toMatchObject({ frameIndex: 1, still: true });
  expect(second.art[0]).toMatchObject({ frameIndex: 1, still: true });
  first.art[0]?.onComplete?.();
  second.art[0]?.onComplete?.();
  expect(completed).toHaveBeenCalledTimes(1);
  group.state.x = 10;
  group.state.alpha = 0.5;
  const time = { firingNow: 5, momentNow: 5, now: 10 };
  projection.update(time);
  expect(second.node.state).toMatchObject({ alpha: 0.5, x: 10 });
  expect(first.painter.update).toHaveBeenCalledExactlyOnceWith(time);
  expect(second.painter.update).toHaveBeenCalledExactlyOnceWith(time);
  group.dispose();
  projection.dispose();
  expect(first.node.dispose).toHaveBeenCalledTimes(1);
  expect(second.node.dispose).toHaveBeenCalledTimes(1);
  expect(first.painter.dispose).toHaveBeenCalledTimes(1);
  expect(second.painter.dispose).toHaveBeenCalledTimes(1);
});

it("keeps projected dog cards in the lit bar surface while body moments dim and full Help covers both", () => {
  const doc = new FakeDocument();
  const { element, layer } = fakeLayer(doc, domScale(1, { height: 560, width: 360, x: 0, y: 0 }));
  const body = doc.createElement("div"),
    bar = doc.createElement("div"),
    card = doc.createElement("div");
  const hex = (value: number) => `#${value.toString(16).padStart(6, "0")}`;
  for (const root of [body, bar]) {
    const priorities = new Map<string, string>();
    Object.assign(root, { isConnected: true });
    Object.assign(root.style, {
      getPropertyPriority: (key: string) => priorities.get(key) ?? "",
      getPropertyValue: (key: string) => root.style[key] ?? "",
      setProperty: (key: string, value: string, priority = "") => {
        root.style[key] = value;
        priorities.set(key, priority);
      },
    });
  }
  body.style.color = card.style.color = hex(PALETTE.cream);
  element.append(body, bar);
  const projection = projectHudCards(
    [{ element: bar as unknown as HTMLElement }],
    [
      {
        anchor: vi.fn(),
        dispose: vi.fn(),
        element: card as unknown as HTMLElement,
        flashCard: vi.fn(),
        revealed: Promise.resolve(true),
        setInert: vi.fn(),
        setShown: vi.fn(),
        update: vi.fn(),
      } satisfies HudCards,
    ],
  );
  expect(bar.contains(card)).toBe(true);
  expect(body.contains(card)).toBe(false);
  const originalFilter = body.style.filter;
  const stop = followModalUnderlay(layer.input, body as unknown as HTMLElement);
  const pause = layer.input.open();
  expect(body.style.color).toBe(hex(PALETTE.cream));
  expect(body.style.filter).toBe("brightness(0.28)");
  expect(bar.style.filter ?? "").toBe("");
  expect(card.style.filter ?? "").toBe("");
  expect(card.style.color).toBe(hex(PALETTE.cream));
  const restore = coverHelpUnderlay(element as unknown as HTMLElement);
  expect(body.style.display).toBe("none");
  expect(bar.style.display).toBe("none");
  restore();
  expect(body.style.display).toBe("");
  expect(bar.style.display).toBe("");
  pause.close();
  expect(body.style.filter).toBe(originalFilter);
  expect(body.style.color).toBe(hex(PALETTE.cream));
  stop();
  projection.dispose();
});
