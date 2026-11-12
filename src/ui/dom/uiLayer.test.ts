import { afterEach, describe, expect, it, vi } from "vitest";

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
