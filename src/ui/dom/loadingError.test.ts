import type { LoadingFailurePresentation } from "@andornaut/game-kit/runtime/web/progress/dom/loadingFailure";
import { expect, it, vi } from "vitest";

import { BUTTON_SIZE } from "../../data/layout.ts";
import { FakeDocument, fakeLayer } from "../../testing/fakeDom.ts";
import type { DomScale } from "../domScale.ts";
import { mountLoadingError } from "./loadingError.ts";

const shared = vi.hoisted(() => ({
  dispose: vi.fn(),
  mount: vi.fn(),
  setPresentation: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@andornaut/game-kit/runtime/web/progress/dom/loadingFailure", () => ({
  mountLoadingFailure(context: unknown, parent: HTMLElement) {
    const element = parent.ownerDocument.createElement("div");
    const button = parent.ownerDocument.createElement("button");
    element.append(button);
    element.querySelector = (() => button) as typeof element.querySelector;
    parent.append(element);
    shared.mount(context, parent, element);
    return {
      dispose: shared.dispose,
      element,
      setPresentation: shared.setPresentation,
      update: shared.update,
    };
  },
}));
vi.mock("@andornaut/game-kit/runtime/web/ui/dom/modalLayer", () => ({
  createModalLayer: () => ({ dispose: vi.fn(), open: () => vi.fn() }),
}));
vi.mock("./modalLifecycle.ts", () => ({ guardNativeInput: () => vi.fn() }));
vi.mock("./muteControl.ts", () => ({ mountMuteControl: () => vi.fn() }));

it("keeps the shared panel and fixed CSS text while fitting only its normal action on resize", async () => {
  vi.clearAllMocks();
  const doc = new FakeDocument();
  const parent = doc.createElement("main");
  const scale = { dpr: 2.625, origin: { x: 0, y: 0 }, unit: 1.5 };
  const { layer } = fakeLayer(doc, scale);
  let onScale!: (scale: DomScale) => void;
  const unsubscribe = vi.fn();
  layer.onScale = (listener) => {
    onScale = listener;
    return unsubscribe;
  };
  const retry = vi.fn(async () => {});
  const view = mountLoadingError(
    {
      layer,
      retry,
      settings: { current: { muted: false }, onChange: () => vi.fn(), setMuted: vi.fn() },
    },
    parent as unknown as HTMLElement,
  );
  const [context, root, element] = shared.mount.mock.calls[0]! as unknown as [
    { onRetry(): void | PromiseLike<void>; presentation: LoadingFailurePresentation },
    HTMLElement,
    HTMLElement,
  ];
  expect(root).toBe(parent.children[0]);
  expect(root.className).toBe("adw-loading-error");
  expect(element.className).not.toBe("crash-panel");
  const first = context.presentation;
  expect(first.action.widthPx).toBe(BUTTON_SIZE.compact.width * scale.unit);
  expect(first.action.heightPx).toBe(BUTTON_SIZE.compact.height * scale.unit);
  expect(first.panel).toMatchObject({ maxWidthPx: 328, safeInsetPx: 16 });
  expect(first.text).toMatchObject({
    action: { sizePx: 18 },
    body: { sizePx: 18 },
    title: { sizePx: 24 },
  });
  view.show({ attempt: 1, error: "503", kind: "failed" });
  await context.onRetry();
  expect(retry).toHaveBeenCalledOnce();
  // A small landscape fit retains the approved logical height, without a CSS-size floor.
  scale.unit = 240 / 560;
  onScale(scale);
  const next = shared.setPresentation.mock.lastCall![0] as LoadingFailurePresentation;
  expect(next.action.heightPx).toBe(BUTTON_SIZE.compact.height * scale.unit);
  expect(next.action.heightPx).toBeLessThan(48);
  expect(next.text).toEqual(first.text);
  expect(next.panel).toEqual(first.panel);
  expect(next.palette).toEqual(first.palette);
  expect(shared.mount).toHaveBeenCalledOnce();
  expect(shared.update).toHaveBeenCalledExactlyOnceWith({
    attempt: 1,
    error: "503",
    kind: "failed",
  });
  view.hide();
  await context.onRetry();
  expect(retry).toHaveBeenCalledOnce();
  view.dispose();
  expect(unsubscribe).toHaveBeenCalledOnce();
  expect(shared.dispose).toHaveBeenCalledOnce();
  await context.onRetry();
  expect(retry).toHaveBeenCalledOnce();
});
