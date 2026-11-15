import { expect, it, vi } from "vitest";

import { FakeDocument, type FakeElement, fakeLayer } from "../../testing/fakeDom.ts";
import { gameFont } from "../../testing/fontInk.ts";
import { domScale, gridRect } from "../../ui/domScale.ts";
import { createHudMoments } from "./hudMoments.ts";
function setup(scale = domScale(1, { height: 560, width: 360, x: 0, y: 0 })) {
  const doc = new FakeDocument();
  const { element, layer } = fakeLayer(doc, scale);
  const json = {
    frames: {
      first: { duration: 60, frame: { h: 16, w: 16, x: 0, y: 0 } },
      last: { duration: 80, frame: { h: 16, w: 16, x: 16, y: 0 } },
    },
    meta: { frameTags: [{ from: 0, name: "play", to: 1 }], size: { h: 16, w: 32 } },
  };
  const source = {
    artUrl: (path: string) => `/art/${path}`,
    loadSheet: vi.fn().mockResolvedValue(json),
  };
  const painter = createHudMoments(
    layer,
    source,
    {
      body: gameFont("font-body"),
      display: gameFont("font-display"),
      title: gameFont("font-title"),
    },
    () => true,
    () => undefined,
  );
  return {
    element: painter.element as unknown as FakeElement,
    layerElement: element,
    painter,
    source,
  };
}
it("keeps a heart flight on the held feedback clock and completes its native playback once", async () => {
  const { element, layerElement, painter, source } = setup(
    domScale(3, { height: 894, width: 575, x: 0, y: 0 }),
  );
  await expect(
    painter.prepare([
      { key: "fx-heart-loss", kind: "sheet" },
      { key: "icon-treat", kind: "image" },
    ]),
  ).resolves.toEqual(["/art/sprites/fx-heart-loss.png", "/art/images/icon-treat.png"]);
  expect(source.loadSheet).toHaveBeenCalledTimes(1);
  expect(source.loadSheet).toHaveBeenCalledWith("/art/sprites/fx-heart-loss.json");
  const view = painter.group(60);
  const complete = vi.fn();
  const playback = view.art({
    at: { x: 50, y: 70 },
    key: "fx-heart-loss",
    onComplete: complete,
    origin: { x: 0.5, y: 0.5 },
    tags: ["play"],
  });
  await playback.ready;
  painter.update({ firingNow: 0, momentNow: 60, now: 60 });
  const root = element.children[0]!;
  expect(root.children[0]!.style.backgroundPosition).toBe("-64px 0px");
  view.state.x = 7;
  painter.update({ firingNow: 0, momentNow: 60, now: 1000 });
  expect(complete).not.toHaveBeenCalled();
  expect(root.style.transform).toContain("translate(32px, 0px)");
  painter.update({ firingNow: 0, momentNow: 140, now: 1100 });
  painter.update({ firingNow: 0, momentNow: 150, now: 1200 });
  expect(complete).toHaveBeenCalledTimes(1);
  playback.dispose();
  expect(root.children).toHaveLength(0);
  painter.dispose();
  expect(element.children).toHaveLength(0);
  expect(layerElement.children).toHaveLength(0);
});
it("keeps live warning art separate from paused firing art and supports a static final pose", async () => {
  const { element, painter } = setup();
  const firing = painter.group(50, "firingNow");
  const warning = painter.group(0, "now");
  const frozen = painter.group(51, "firingNow");
  const complete = vi.fn();
  await Promise.all([
    firing.art({ at: { x: 0, y: 0 }, key: "fx-fired-pop", tags: ["play"] }).ready,
    warning.art({ at: { x: 0, y: 0 }, key: "ui-dog-card-warn", loop: true, tags: ["play"] }).ready,
    frozen.art({ at: { x: 0, y: 0 }, key: "fx-fired-pop", last: true, still: true, tags: ["play"] })
      .ready,
  ]);
  painter.update({ firingNow: 0, momentNow: 0, now: 90 });
  expect(element.children.map((root) => root.children[0]!.style.backgroundPosition)).toEqual([
    "0px 0px",
    "-16px 0px",
    "-16px 0px",
  ]);
  painter.update({ firingNow: 1000, momentNow: 0, now: 1000 });
  expect(complete).not.toHaveBeenCalled();
  painter.dispose();
});
it("does not paint disposed moment roots when a completion callback replaces them", async () => {
  const { element, painter } = setup();
  const old = painter.group(50);
  await old.art({
    at: { x: 0, y: 0 },
    key: "fx-fired-pop",
    onComplete: () => {
      old.dispose();
      const next = painter.group(60);
      next.ring({ height: 32, width: 112, x: 4, y: 44 }, 0xff0000, 2);
      next.panel(
        { height: 13, width: 100, x: 0, y: 40 },
        {
          key: "ui-zone-pill",
          kind: "image",
          native: { height: 13, width: 13 },
          slices: { bottom: 0, left: 4, right: 4, top: 0 },
        },
      );
    },
    tags: ["play"],
  }).ready;
  painter.update({ firingNow: 0, momentNow: 140, now: 140 });
  expect(element.children).toHaveLength(1);
  const ring = element.children[0]!.children[0]!;
  expect(ring.style).toMatchObject({
    borderWidth: "2px",
    height: "32px",
    left: "4px",
    width: "112px",
  });
  expect(ring.style.backgroundColor).toBeUndefined();
  const pill = element.children[0]!.children[1]!;
  expect(pill.style).toMatchObject({ height: "13px", width: "100px" });
  expect(pill.children).toHaveLength(3);
  expect((old.element as unknown as FakeElement).parent).toBeUndefined();
  painter.dispose();
});

it("keeps persistent HUD images and sheets on their logical rectangles at phone DPRs", async () => {
  await Promise.all(
    [1, 2.625].map(async (dpr) => {
      const scale = domScale(dpr, { height: 844, width: 390, x: 0, y: 0 });
      const { element, painter } = setup(scale);
      const group = painter.group(0);
      const rects = [
        { height: 76, width: 360, x: 0, y: 484 },
        { height: 24, width: 24, x: 158, y: 7 },
      ];
      for (const rect of rects) {
        group.art({ at: rect, image: rect, key: "ui-dog-card-band", projection: "layout" });
      }
      const sheet = group.art({
        at: { x: 123, y: 490 },
        key: "ui-heart",
        projection: "layout",
        still: true,
        tags: ["play"],
      });
      await sheet.ready;
      painter.update({ firingNow: 0, momentNow: 0, now: 0 });
      const children = element.children[0]!.children;
      [...rects, { height: 16, width: 16, x: 123, y: 490 }].forEach((rect, index) => {
        const expected = gridRect(scale, rect);
        expect(children[index]!.style).toMatchObject({
          height: `${expected.height}px`,
          left: `${expected.left}px`,
          top: `${expected.top}px`,
          width: `${expected.width}px`,
        });
      });
      painter.dispose();
    }),
  );
});
