import type { LoadingFailurePresentation } from "@andornaut/game-kit/runtime/web/progress/dom/loadingFailure";
import { expect, it, vi } from "vitest";

import { BUTTON_SIZE, MODAL_SPACING, MODAL_WIDTHS } from "../../data/layout.ts";
import { SCREEN_CONFIG } from "../../data/screen.ts";
import { FakeDocument, fakeLayer } from "../../testing/fakeDom.ts";
import type { DomScale } from "../domScale.ts";
import { MODAL } from "../modalGeometry.ts";
import { PALETTE } from "../palette.ts";
import { PAPER_PANEL } from "../paperPanel.ts";
import { ACTION_LABEL_SCALE, TEXT_SCALE } from "../textFit.ts";
import { mountLaunchFailure } from "./launchFailure.ts";
import { mountLoadingError } from "./loadingError.ts";
import { loadingFailurePresentation } from "./loadingFailureStyle.ts";

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

it("keeps fixed CSS text while fitting its Large width, margin and action on resize", async () => {
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
    },
    parent as unknown as HTMLElement,
  );
  const [context, root, element] = shared.mount.mock.calls[0]! as unknown as [
    { onRetry(): void | PromiseLike<void>; presentation: LoadingFailurePresentation<"content"> },
    HTMLElement,
    HTMLElement,
  ];
  expect(root).toBe(parent.children[0]);
  expect(root.className).toBe("adw-loading-error");
  expect(element.className).not.toBe("crash-panel");
  const first = context.presentation;
  expect(first.action.widthPx).toBe("content");
  expect(first.action.paddingXPx).toBe(MODAL.pad * scale.unit);
  expect(first.action.heightPx).toBe(BUTTON_SIZE.compact.height * scale.unit);
  expect(first.panel).toMatchObject({
    maxWidthPx: MODAL_WIDTHS.large * scale.unit,
    safeInsetPx: MODAL_SPACING.margin * scale.unit,
  });
  expect(first.text).toMatchObject({
    action: { sizePx: (18 * ACTION_LABEL_SCALE) / TEXT_SCALE },
    body: { sizePx: 18 },
    title: { sizePx: 24 },
  });
  view.show({ attempt: 1, error: "503", kind: "failed" });
  expect(parent.all().filter((node) => node.tagName === "button")).toHaveLength(1);
  await context.onRetry();
  expect(retry).toHaveBeenCalledOnce();
  // A small landscape fit retains the approved logical height, without a CSS-size floor.
  scale.unit = 240 / 560;
  onScale(scale);
  const next = shared.setPresentation.mock.lastCall![0] as LoadingFailurePresentation<"content">;
  expect(next.action.widthPx).toBe("content");
  expect(next.action.paddingXPx).toBe(MODAL.pad * scale.unit);
  expect(next.action.heightPx).toBe(BUTTON_SIZE.compact.height * scale.unit);
  expect(next.action.heightPx).toBeLessThan(48);
  expect(next.text).toEqual(first.text);
  expect(next.panel).toEqual({
    ...first.panel,
    maxWidthPx: MODAL_WIDTHS.large * scale.unit,
    safeInsetPx: MODAL_SPACING.margin * scale.unit,
  });
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

it("uses the same intrinsic Retry before game fonts and art load, including viewport resize", () => {
  vi.clearAllMocks();
  const doc = new FakeDocument();
  Object.assign(doc.defaultView, {
    innerHeight: SCREEN_CONFIG.height,
    innerWidth: SCREEN_CONFIG.width,
  });
  const parent = doc.createElement("main");
  const retry = vi.fn();
  const view = mountLaunchFailure(retry, parent as unknown as HTMLElement);
  const context = shared.mount.mock.calls[0]![0] as {
    onRetry(): void;
    presentation: LoadingFailurePresentation<"content">;
  };
  expect(context.presentation.action).toMatchObject({
    heightPx: BUTTON_SIZE.compact.height,
    paddingXPx: MODAL.pad,
    widthPx: "content",
  });
  view.update({ attempt: 1, error: "503", kind: "failed" });
  expect(parent.all().filter((node) => node.tagName === "button")).toHaveLength(1);
  context.onRetry();
  expect(retry).toHaveBeenCalledOnce();
  Object.assign(doc.defaultView, { innerHeight: 240, innerWidth: 560 });
  doc.defaultView.fire("resize");
  const presentation = shared.setPresentation.mock
    .lastCall![0] as LoadingFailurePresentation<"content">;
  const unit = 240 / SCREEN_CONFIG.height;
  expect(presentation.action).toMatchObject({
    heightPx: BUTTON_SIZE.compact.height * unit,
    paddingXPx: MODAL.pad * unit,
    widthPx: "content",
  });
  expect(presentation.text).toEqual(context.presentation.text);
  view.dispose();
  expect(shared.dispose).toHaveBeenCalledOnce();
  expect(doc.defaultView.listeners.get("resize")).toHaveLength(0);
});

it("gives the kit panel the modal paper's bevel row under its top border", () => {
  const { palette, panel } = loadingFailurePresentation(1);
  expect(panel.highlightHeightPx).toBe(PAPER_PANEL.bevel);
  expect(palette.panelHighlight).toBe(
    `#${PALETTE[PAPER_PANEL.colours.bevel].toString(16).padStart(6, "0")}`,
  );
});
