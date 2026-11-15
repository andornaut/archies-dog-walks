import { expect, it, vi } from "vitest";

import { FakeDocument, fakeLayer } from "../testing/fakeDom.ts";
import type { UiLayer } from "../ui/dom/uiLayer.ts";
import { type DomScale, domScale, gridTransform } from "../ui/domScale.ts";
import { createNativeHudPicture } from "./nativeHudPicture.ts";

it("projects each passive strip without scaling twice and follows its actual content origin", () => {
  const doc = new FakeDocument();
  const original = domScale(3, { height: 700, width: 450, x: 12.2, y: 30.4 });
  const { element, layer } = fakeLayer(doc, original);
  const scaleListeners = new Set<(scale: DomScale) => void>();
  const readyListeners = new Set<() => void>();
  const parentDispose = vi.fn();
  const source: UiLayer = {
    ...layer,
    dispose: parentDispose,
    onReady: (listener) => {
      readyListeners.add(listener);
      return () => readyListeners.delete(listener);
    },
    onScale: (listener) => {
      scaleListeners.add(listener);
      return () => scaleListeners.delete(listener);
    },
  };
  const unrelated = doc.createElement("div");
  element.append(unrelated);
  const projected = createNativeHudPicture(source, {
    frame: { height: 60, width: 300, x: 20, y: 150 },
    strips: [
      { height: 20, screenY: 0 },
      { height: 40, screenY: 60 },
    ],
  });
  const [first, second] = projected.layers;
  expect(projected.layers).toHaveLength(2);
  const clips = element.children.slice(1);
  expect(clips[0]!.style).toMatchObject({
    height: "25px",
    left: "25px",
    top: "187.5px",
    width: "375px",
  });
  expect(clips[1]!.style).toMatchObject({
    height: "50px",
    left: "25px",
    top: "212.5px",
    width: "375px",
  });
  expect(clips.every((clip) => clip.inert && clip.getAttribute("aria-hidden") === "true")).toBe(
    true,
  );
  expect(second!.element.style.top).toBe("-75px");
  expect(clips[0]!.style.transform).toBeUndefined();
  expect(second!.element.style.transform).toBeUndefined();
  expect(second!.scale()).toEqual({ dpr: 3, origin: { x: 37.2, y: 167.9 }, unit: 1.25 });
  expect(gridTransform(second!.scale())).toContain("scale(0.3333333333333333)");
  expect(first!.input).toBe(layer.input);
  const changed = vi.fn(),
    ready = vi.fn();
  second!.onScale(changed);
  second!.onReady(ready);
  const resized = domScale(2, { height: 560, width: 360, x: 0, y: 8 });
  scaleListeners.forEach((listener) => listener(resized));
  readyListeners.forEach((listener) => listener());
  expect(second!.scale()).toEqual({ dpr: 2, origin: { x: 20, y: 118 }, unit: 1 });
  expect(changed).toHaveBeenCalledOnce();
  expect(ready).toHaveBeenCalledOnce();
  projected.dispose();
  projected.dispose();
  expect(element.children).toEqual([unrelated]);
  expect(parentDispose).not.toHaveBeenCalled();
  expect(scaleListeners.size).toBe(0);
  expect(readyListeners.size).toBe(0);
});

it("forwards owned reveals and cancels only pending strip resources on disposal", async () => {
  const doc = new FakeDocument();
  const { layer } = fakeLayer(doc, domScale(1, { height: 560, width: 360, x: 0, y: 0 }));
  const cancel = vi.fn();
  let settle: ((value: boolean) => void) | undefined;
  const pending = new Promise<boolean>((resolve) => {
    settle = resolve;
  });
  const reveal = vi.fn(() => ({ cancel, revealed: pending }));
  const parent = { ...layer, reveal };
  const projected = createNativeHudPicture(parent, {
    frame: { height: 30, width: 300, x: 20, y: 150 },
    strips: [{ height: 30, screenY: 24 }],
  });
  const context = projected.layers[0]!;
  const art = doc.createElement("div") as unknown as HTMLElement;
  context.element.append(art);
  context.reveal(["/art/hud.png"], art);
  expect(reveal).toHaveBeenCalledWith(["/art/hud.png"], art);
  expect(() => context.reveal([], layer.element)).toThrow("inside its own strip");
  projected.dispose();
  expect(cancel).toHaveBeenCalledOnce();
  settle?.(false);
  expect(context.ready()).toBe(false);
  await expect(context.reveal([], art).revealed).resolves.toBe(false);
});
