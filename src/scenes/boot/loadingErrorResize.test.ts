import { afterEach, expect, it, vi } from "vitest";

import { FakeDocument } from "../../testing/fakeDom.ts";
import { mountUiLayer } from "../../ui/dom/uiLayer.ts";
import { worldViewBox } from "../../ui/worldFit.ts";
import { pauseLoadingError } from "./loadingErrorPause.ts";

vi.mock("../../ui/dom/domCuts.ts", () => ({
  cutDomArt: vi.fn(() => Promise.resolve("blob:cut")),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("refits the existing native error frame on canvas resize while required failure keeps Phaser paused", async () => {
  vi.stubGlobal("devicePixelRatio", 2.625);
  vi.stubGlobal("document", { body: null });
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubGlobal(
    "FontFace",
    class {
      load = () => Promise.reject(new Error("required font503"));
    },
  );
  let resized!: ResizeObserverCallback;
  let observer!: ResizeObserver;
  const observe = vi.fn();
  const disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        resized = callback;
        observer = this as unknown as ResizeObserver;
      }
      observe = observe;
      disconnect = disconnect;
    },
  );
  const doc = new FakeDocument();
  const element = doc.createElement("div");
  const body = doc.body;
  const frame = Object.assign(doc.createElement("div"), {
    clientLeft: 0,
    clientTop: 0,
    clientWidth: 575,
    offsetLeft: 0,
    offsetParent: body,
    offsetTop: 0,
  });
  body.append(frame, element);
  vi.stubGlobal("document", { body });
  const page = Object.assign(doc, {
    fonts: { add: () => undefined },
    getElementById: () => element,
  });
  const canvas = Object.assign(doc.createElement("canvas"), {
    offsetHeight: 1280,
    offsetLeft: 0,
    offsetParent: frame,
    offsetTop: 0,
    offsetWidth: 575,
  });
  Object.assign(canvas.style, { height: "1280px", marginLeft: "", width: "575px" });
  frame.append(canvas);
  const scale = { gameSize: { height: 1280, width: 575 }, zoom: 1 };
  const layer = mountUiLayer(
    page as unknown as Document,
    canvas as unknown as HTMLCanvasElement,
    (box) => worldViewBox(scale, box),
  )!;
  await Promise.resolve();
  await Promise.resolve();
  expect(layer.fontStatus()).toBe("failed");
  expect(observe.mock.calls.map(([node]) => node)).toEqual([canvas, frame, body]);
  const game = {
    isPaused: false,
    pause: vi.fn(() => {
      game.isPaused = true;
    }),
    resume: vi.fn(),
  };
  const error = pauseLoadingError(game, { dispose: vi.fn(), hide: vi.fn(), show: vi.fn() });
  error.show({ attempt: 1, error: "required font503", kind: "failed" });
  const changed = vi.fn();
  layer.onScale(changed);
  canvas.style.width = "390px";
  canvas.style.height = "844px";
  scale.gameSize.width = 390;
  scale.gameSize.height = 844;
  // Only the browser resize notification runs; no render or resource-ready event is emitted.
  resized([], observer);
  expect(game.isPaused).toBe(true);
  expect(game.resume).not.toHaveBeenCalled();
  expect(element.style.width).toBe("390px");
  expect(element.style.height).toBe("607px");
  expect(layer.scale().unit).toBeCloseTo(390 / 360);
  expect(changed).toHaveBeenCalledOnce();
  resized([], observer);
  expect(changed).toHaveBeenCalledOnce();
  // A wider frame moves a fixed-size canvas into a new letterbox position.
  frame.clientWidth = 1000;
  canvas.style.marginLeft = "125px";
  resized([{ target: frame } as unknown as ResizeObserverEntry], observer);
  expect(element.style.width).toBe("390px");
  expect(element.style.left).toBe("125px");
  expect(layer.scale().unit).toBeCloseTo(390 / 360);
  expect(changed).toHaveBeenCalledTimes(2);
  expect(game.isPaused).toBe(true);
  expect(game.resume).not.toHaveBeenCalled();
  layer.dispose();
  expect(disconnect).toHaveBeenCalledOnce();
  canvas.style.width = "1280px";
  resized([], observer);
  expect(element.style.width).toBe("390px");
  expect(changed).toHaveBeenCalledTimes(2);
  error.dispose();
  warning.mockRestore();
});
