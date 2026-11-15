import { afterEach, describe, expect, it, vi } from "vitest";

import { createPressAdmission } from "../../pressAdmission.ts";
import { FakeDocument } from "../../testing/fakeDom.ts";
import { mountUiLayer, UI_LAYER_ID, WEB_FONTS } from "./uiLayer.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the HTML interface's layer", () => {
  it("mounts with no <style> element, which the page's CSP would block", () => {
    vi.stubGlobal("devicePixelRatio", 1);
    vi.stubGlobal("document", { body: null });
    vi.stubGlobal(
      "FontFace",
      class {
        load = () => Promise.resolve();
      },
    );
    const doc = new FakeDocument();
    const createElement = vi.spyOn(doc, "createElement");
    const element = doc.createElement("div");
    element.hidden = true;
    const head = doc.createElement("head");
    const fonts: unknown[] = [];
    const page = Object.assign(doc, {
      fonts: { add: (face: unknown) => fonts.push(face) },
      getElementById: (id: string) => (id === UI_LAYER_ID ? element : null),
      head,
    });
    const canvas = {
      offsetHeight: 604,
      offsetLeft: 0,
      offsetParent: null,
      offsetTop: 0,
      offsetWidth: 360,
      style: { height: "604px", marginLeft: "", width: "360px" },
    };
    createElement.mockClear();

    const layer = mountUiLayer(page as unknown as Document, canvas as unknown as HTMLCanvasElement);

    expect(layer?.element).toBe(element);
    expect(element.hidden).toBe(false);
    expect(fonts).toHaveLength(Object.keys(WEB_FONTS).length);
    expect(createElement).not.toHaveBeenCalled();
    expect(head.children).toEqual([]);
  });
});

it("promotes fonts without changing the provided world view or notifying disposed consumers", async () => {
  vi.stubGlobal("devicePixelRatio", 1);
  vi.stubGlobal("document", { body: null });
  const complete: (() => void)[] = [];
  vi.stubGlobal(
    "FontFace",
    class {
      load = () =>
        new Promise<void>((resolve) => {
          complete.push(resolve);
        });
    },
  );
  const doc = new FakeDocument();
  const element = doc.createElement("div");
  const page = Object.assign(doc, {
    fonts: { add: () => undefined },
    getElementById: () => element,
  });
  const canvas = {
    offsetHeight: 800,
    offsetLeft: 0,
    offsetParent: null,
    offsetTop: 0,
    offsetWidth: 600,
    style: { height: "800px", marginLeft: "", width: "600px" },
  };
  const press = createPressAdmission(() => false);
  const layer = mountUiLayer(
    page as unknown as Document,
    canvas as unknown as HTMLCanvasElement,
    (box) => ({ height: 560, width: 360, x: box.x + 120, y: box.y }),
    press,
  );
  expect(layer?.press).toBe(press);
  const changed = vi.fn();
  const off = layer?.onReady(changed);
  expect(changed).not.toHaveBeenCalled();
  expect(layer?.ready()).toBe(false);
  expect(layer?.scale()).toMatchObject({ origin: { x: 120, y: 0 }, unit: 1 });
  for (const resolve of complete) {
    resolve();
  }
  await Promise.resolve();
  expect(layer?.ready()).toBe(true);
  expect(changed).toHaveBeenCalledTimes(Object.keys(WEB_FONTS).length);
  off?.();
  layer?.dispose();
  expect(layer?.ready()).toBe(false);
  const stale = layer?.reveal([], element as unknown as HTMLElement);
  await expect(stale?.revealed).resolves.toBe(false);
});
