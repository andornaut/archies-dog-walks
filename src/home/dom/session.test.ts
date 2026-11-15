import { describe, expect, it, vi } from "vitest";

import { FakeDocument, type FakeElement, fakeLayer } from "../../testing/fakeDom.ts";
import { domScale } from "../../ui/domScale.ts";
import type { NativeHomeView } from "./screen.ts";
import { createNativeHomeSession } from "./session.ts";
vi.mock("../../ui/dom/rampDim.ts", () => ({
  followModalUnderlay: () => Object.assign(() => undefined, { refresh: () => undefined }),
}));
function fixture() {
  const doc = new FakeDocument();
  const { layer } = fakeLayer(doc, domScale(1, { height: 560, width: 360, x: 0, y: 0 }));
  const frames: (() => void)[] = [];
  Object.assign(doc.defaultView, {
    cancelAnimationFrame: vi.fn(),
    requestAnimationFrame: (callback: () => void) => {
      frames.push(callback);
      return frames.length;
    },
  });
  const reveals: {
    cancel: ReturnType<typeof vi.fn>;
    settle: (ready: boolean) => void;
  }[] = [];
  Object.assign(layer, {
    reveal: () => {
      let settle: (value: boolean) => void = () => undefined;
      const revealed = new Promise<boolean>((resolve) => {
        settle = resolve;
      });
      const cancel = vi.fn(() => settle(false));
      reveals.push({ cancel, settle });
      return { cancel, revealed };
    },
  });
  const context = {
    accepts: () => true,
    activate: vi.fn(),
    cancel: vi.fn(),
    down: vi.fn(),
    move: vi.fn(),
    painted: vi.fn(),
    up: vi.fn(),
  };
  const session = createNativeHomeSession(layer, context);
  const view = () => {
    const element = doc.createElement("div");
    const button = doc.createElement("button");
    element.append(button);
    return {
      controls: new Map([["start", button]]),
      dispose: vi.fn(() => element.remove()),
      element,
      ready: Promise.resolve([]),
    } as unknown as NativeHomeView;
  };
  return { context, doc, frames, layer, reveals, session, view };
}
describe("native home visit", () => {
  it("admits only the current decoded paint across view replacements", async () => {
    const f = fixture();
    const first = f.view();
    f.session.replace(first);
    f.session.replace(f.view());
    expect(f.reveals[0]!.cancel).toHaveBeenCalledOnce();
    expect(first.dispose).toHaveBeenCalledOnce();
    f.reveals[0]!.settle(true);
    f.reveals[1]!.settle(true);
    await Promise.resolve();
    expect(f.session.accepts()).toBe(false);
    f.frames.forEach((paint) => paint());
    expect(f.context.painted).toHaveBeenCalledOnce();
    expect(f.session.accepts()).toBe(true);
    f.session.dispose();
    expect(f.session.accepts()).toBe(false);
  });
  it("restores the same focused native control after its replacement is painted", async () => {
    const f = fixture();
    const first = f.view();
    f.session.replace(first);
    f.reveals[0]!.settle(true);
    await Promise.resolve();
    f.frames.shift()?.();
    first.controls.get("start")?.focus();
    const next = f.view();
    f.session.replace(next);
    f.reveals[1]!.settle(true);
    await Promise.resolve();
    f.frames.shift()?.();
    expect(f.doc.activeElement).toBe(next.controls.get("start"));
    const heldKey = {
      code: "Enter",
      preventDefault: vi.fn(),
      repeat: true,
      stopPropagation: vi.fn(),
    };
    (f.session.element as unknown as FakeElement).fire("keydown", heldKey);
    expect(heldKey.preventDefault).toHaveBeenCalledOnce();
    expect(heldKey.stopPropagation).toHaveBeenCalledOnce();
    f.session.dispose();
  });
  it("rejects a release captured before a modal opened even after it closes", async () => {
    const f = fixture();
    f.session.replace(f.view());
    f.reveals[0]!.settle(true);
    await Promise.resolve();
    f.frames.forEach((paint) => paint());
    const root = f.session.element as unknown as FakeElement;
    const event = (type: string) => ({
      pointerId: 1,
      preventDefault: vi.fn(),
      stopImmediatePropagation: vi.fn(),
      target: root,
      type,
    });
    root.fire("pointerdown", event("pointerdown"));
    expect(f.context.down).toHaveBeenCalledOnce();
    expect(f.layer.press.canvasAllowed()).toBe(false);
    const modal = f.layer.input.open();
    expect(f.session.accepts()).toBe(false);
    expect(f.layer.press.canvasAllowed()).toBe(true);
    modal.close();
    expect(f.session.accepts()).toBe(true);
    const release = event("pointerup");
    f.doc.fire("pointerup", release);
    expect(release.stopImmediatePropagation).toHaveBeenCalledOnce();
    expect(f.context.up).not.toHaveBeenCalled();
    f.session.dispose();
  });
});
