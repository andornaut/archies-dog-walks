import { createButtonSkin } from "@andornaut/game-kit/web/ui/dom/buttonSkin";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createPressAdmission } from "../../pressAdmission.ts";
import { FakeDocument } from "../../testing/fakeDom.ts";
import { mountUiLayer, UI_LAYER_ID, WEB_FONTS } from "./uiLayer.ts";

vi.mock("@andornaut/game-kit/web/ui/dom/buttonSkin", () => ({
  createButtonSkin: vi.fn(() => ({
    apply: () => Promise.resolve([]),
    frames: Promise.resolve(new Map()),
  })),
}));

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

it("reports a failed required font and retries only that face without late disposal updates", async () => {
  vi.stubGlobal("devicePixelRatio", 1);
  vi.stubGlobal("document", { body: null });
  const attempts: { family: string; resolve(): void; reject(): void }[] = [];
  vi.stubGlobal(
    "FontFace",
    class {
      readonly family: string;
      constructor(family: string) {
        this.family = family;
      }
      load = () =>
        new Promise<void>((resolve, reject) => {
          attempts.push({
            family: this.family,
            reject: () => reject(new Error("font unavailable")),
            resolve,
          });
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
    offsetHeight: 560,
    offsetLeft: 0,
    offsetParent: null,
    offsetTop: 0,
    offsetWidth: 360,
    style: { height: "560px", marginLeft: "", width: "360px" },
  };
  const layer = mountUiLayer(page as unknown as Document, canvas as unknown as HTMLCanvasElement)!;
  const changed = vi.fn();
  layer.onReady(changed);
  expect(layer.fontStatus()).toBe("loading");
  layer.retryFonts();
  expect(attempts).toHaveLength(3);
  attempts[0]!.reject();
  attempts[1]!.resolve();
  attempts[2]!.resolve();
  await Promise.resolve();
  expect(layer.fontStatus()).toBe("failed");
  expect(layer.ready()).toBe(false);
  layer.retryFonts();
  expect(attempts).toHaveLength(4);
  expect(attempts[3]!.family).toBe(attempts[0]!.family);
  expect(layer.fontStatus()).toBe("loading");
  attempts[3]!.resolve();
  await Promise.resolve();
  expect(layer.fontStatus()).toBe("ready");
  expect(layer.ready()).toBe(true);
  layer.retryFonts();
  expect(attempts).toHaveLength(4);
  layer.dispose();
  const calls = changed.mock.calls.length;
  layer.retryFonts();
  await Promise.resolve();
  expect(changed).toHaveBeenCalledTimes(calls);
  expect(layer.ready()).toBe(false);
});

it("notifies loading immediately and keeps a good skin when retrying unrelated HUD art", async () => {
  vi.stubGlobal("devicePixelRatio", 1);
  vi.stubGlobal("document", { body: null });
  vi.stubGlobal(
    "FontFace",
    class {
      load = () => Promise.resolve();
    },
  );
  const doc = new FakeDocument();
  const originalCreate = doc.createElement.bind(doc);
  let hudAttempts = 0;
  vi.spyOn(doc, "createElement").mockImplementation((tag) => {
    const element = originalCreate(tag);
    if (tag === "img") {
      Object.assign(element, {
        decode() {
          if (
            (this as unknown as { src: string }).src.includes("hud-required.png") &&
            hudAttempts++ === 0
          ) {
            return Promise.reject(new Error("HUD unavailable"));
          }
          return Promise.resolve();
        },
      });
    }
    return element;
  });
  const root = doc.createElement("div");
  const page = Object.assign(doc, {
    baseURI: "https://example.test/",
    fonts: { add: () => undefined },
    getElementById: () => root,
  });
  const manifest = {
    sprites: ["ui-button", "ui-icon-button"].map((key) => ({
      json: `required-${key}.json`,
      key,
      png: `required-${key}.png`,
    })),
  };
  const sheet = {
    frames: { normal: { frame: { h: 20, w: 20, x: 0, y: 0 } } },
    meta: { size: { h: 20, w: 20 } },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      Promise.resolve({ json: () => (url.includes("manifest") ? manifest : sheet), ok: true }),
    ),
  );
  const canvas = {
    offsetHeight: 560,
    offsetLeft: 0,
    offsetParent: null,
    offsetTop: 0,
    offsetWidth: 360,
    style: { height: "560px", marginLeft: "", width: "360px" },
  };
  const layer = mountUiLayer(page as unknown as Document, canvas as unknown as HTMLCanvasElement)!;
  layer.requireAssets([]);
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
  expect(layer.ready()).toBe(true);
  const skin = layer.buttonSkin;
  const states: string[] = [];
  const off = layer.onReady(() => states.push(layer.assetStatus()));
  layer.requireAssets([{ kind: "image", url: "/hud-required.png" }]);
  expect(states).toEqual(["loading"]);
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
  expect(layer.failedAssets()).toEqual(["/hud-required.png"]);
  const created = vi.mocked(createButtonSkin).mock.calls.length;
  layer.retryAssets();
  expect(layer.buttonSkin).toBe(skin);
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
  expect(layer.ready()).toBe(true);
  expect(vi.mocked(createButtonSkin).mock.calls.length).toBe(created);
  off();
  layer.dispose();
});
