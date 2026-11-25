import { expect, it, vi } from "vitest";

import { FakeDocument, fakeLayer } from "../../testing/fakeDom.ts";
import { gameFont } from "../../testing/fontInk.ts";
import { domScale } from "../domScale.ts";
import { mountRoadBanner } from "./roadBanner.ts";

// The plate's one frame on its sheet, whose image is at /banner.png.
const SOURCE = {
  artUrl: (path: string) => (path.endsWith(".png") ? "/banner.png" : `/${path}`),
  loadSheet: () =>
    Promise.resolve({
      frames: { "ui-zone-banner 0.aseprite": { frame: { h: 48, w: 248, x: 4, y: 8 } } },
      meta: { size: { h: 100, w: 300 } },
    }),
};

it("keeps canvas fallback until decoding, follows the existing pose and announces a zone once", async () => {
  const doc = new FakeDocument();
  const { element, layer } = fakeLayer(doc, domScale(2, { height: 560, width: 360, x: 0, y: 0 }));
  const modal = doc.createElement("section");
  element.append(modal);
  let settle!: (decoded: boolean) => void;
  const cancel = vi.fn();
  layer.reveal = () => ({
    cancel,
    revealed: new Promise((resolve) => {
      settle = resolve;
    }),
  });
  const pose = { active: true, alpha: 1, x: -240, y: 110 };
  const shown = vi.fn();
  const view = mountRoadBanner(layer, SOURCE, {
    heading: "Toronto, neighbourhood 1",
    name: "The Beach",
    nameFont: { bitmap: gameFont("font-title"), font: "title", scale: 2 },
    pose: () => pose,
    shown,
    title: gameFont("font-title"),
  });
  const root = element.children[0]!;
  const status = root.children.at(-1)!;
  expect(element.children[1]).toBe(modal);
  expect(root.hidden).toBe(true);
  expect(shown).toHaveBeenLastCalledWith(false);
  const cover = layer.input.open();
  settle(true);
  await Promise.resolve();
  expect(root.hidden).toBe(false);
  expect(root.attributes.get("aria-hidden")).toBe("true");
  expect(status.textContent).toBe("");
  expect(root.style.filter).toBe("brightness(0.28)");
  expect(root.children[0]!.style.backgroundImage).toBe('url("/banner.png")');
  cover.close();
  expect(root.children[0]!.style.backgroundImage).toBe('url("/banner.png")');
  expect(status.textContent).toBe("Toronto, neighbourhood 1. The Beach");
  pose.x = 50;
  pose.alpha = 0.5;
  view.update();
  expect(root.children[0]!.style).toMatchObject({
    backgroundPosition: "-8px -16px",
    backgroundSize: "600px 200px",
    left: "100px",
  });
  expect(root.style.opacity).toBe("0.5");
  const coverAgain = layer.input.open();
  expect(status.attributes.get("aria-hidden")).toBe("true");
  coverAgain.close();
  expect(status.attributes.get("aria-hidden")).toBe("true");
  expect(doc.activeElement).toBeNull();
  view.destroy();
  view.destroy();
  expect(cancel).toHaveBeenCalledOnce();
  expect(element.children).toEqual([modal]);
});

it("does not reveal or announce a destroyed banner when a late image settles", async () => {
  const doc = new FakeDocument();
  const { element, layer } = fakeLayer(doc, domScale(1, { height: 560, width: 360, x: 0, y: 0 }));
  let settle!: (decoded: boolean) => void;
  layer.reveal = () => ({
    cancel: vi.fn(),
    revealed: new Promise((resolve) => {
      settle = resolve;
    }),
  });
  const shown = vi.fn();
  const view = mountRoadBanner(layer, SOURCE, {
    heading: "Toronto",
    name: "The Beach",
    nameFont: { bitmap: gameFont("font-title"), font: "title", scale: 2 },
    pose: () => ({ active: true, alpha: 1, x: 50, y: 110 }),
    shown,
    title: gameFont("font-title"),
  });
  view.destroy();
  shown.mockClear();
  settle(true);
  await Promise.resolve();
  view.update();
  expect(element.children).toEqual([]);
  expect(shown).not.toHaveBeenCalled();
});
