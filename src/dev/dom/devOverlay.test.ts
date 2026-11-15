import { expect, it, vi } from "vitest";

import { SCREEN_LAYOUT } from "../../data/screen.ts";
import { FakeDocument, fakeLayer } from "../../testing/fakeDom.ts";
import { deviceX, deviceY, domScale, gridTransform } from "../../ui/domScale.ts";
import { mountDevOverlay } from "./devOverlay.ts";

it("projects passive diagnostics at the road inset, waits for readiness and removes its subscriptions", () => {
  const doc = new FakeDocument();
  const scale = domScale(2, { height: 1120, width: 720, x: 0, y: 0 });
  const { element, layer } = fakeLayer(doc, scale);
  let ready = false;
  let updated: () => void = () => undefined;
  const offScale = vi.fn();
  const offReady = vi.fn();
  layer.ready = () => ready;
  layer.onScale = () => offScale;
  layer.onReady = (callback) => {
    updated = callback;
    return offReady;
  };
  const claim = vi.spyOn(layer.press, "claim");
  const view = mountDevOverlay(doc as unknown as Document, layer);
  view.setVisible(true);
  expect(view.visible()).toBe(false);
  ready = true;
  updated();
  expect(view.visible()).toBe(true);
  view.setLines(["seed 42  fps 60", "zone 2  1234px"]);
  const root = element.children[0]!;
  const text = root.children[0]!;
  expect(root.style.transform).toBe(gridTransform(scale));
  expect(root.style.pointerEvents).toBe("none");
  expect(text.textContent).toBe("seed 42  fps 60\nzone 2  1234px");
  expect(text.style).toMatchObject({
    fontFamily: "monospace",
    fontSize: "36px",
    left: `${deviceX(scale, SCREEN_LAYOUT.road.x + 2)}px`,
    padding: "8px 12px",
    top: `${deviceY(scale, SCREEN_LAYOUT.road.y + 2)}px`,
  });
  expect(claim).not.toHaveBeenCalled();
  view.dispose();
  view.dispose();
  expect(element.children).toHaveLength(0);
  expect(offScale).toHaveBeenCalledTimes(1);
  expect(offReady).toHaveBeenCalledTimes(1);
  expect(view.visible()).toBe(false);
});
