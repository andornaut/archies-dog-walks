import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { gameData } from "../../data/index.ts";
import { FakeDocument, type FakeElement, fakeLayer } from "../../testing/fakeDom.ts";
import { gameFont } from "../../testing/fontInk.ts";
import { domScale } from "../../ui/domScale.ts";
import { homeSpeechView } from "../speechView.ts";
import type { NativeHomeView } from "./screen.ts";
import { createNativeHomeSession } from "./session.ts";
import { createHomeSpeech } from "./speech.ts";
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
  it("keeps a replaced Sound off notice under the actual Home session dim while a modal scope is open", async () => {
    const f = fixture();
    const scale = domScale(1, { height: 560, width: 360, x: 0, y: 0 });
    f.session.replace(f.view());
    const bar = f.doc.createElement("div");
    f.layer.element.append(bar as unknown as HTMLElement);
    const settings = f.layer.input.open();
    const fonts = { body: gameFont("font-body"), title: gameFont("font-title") };
    const speech = createHomeSpeech(
      f.doc as unknown as Document,
      {
        artUrl: (path) => path,
        hasArt: () => true,
        imageSize: (key) => {
          const png = readFileSync(`public/art/images/${key}.png`);
          return { height: png.readUInt32BE(20), width: png.readUInt32BE(16) };
        },
        loadSheet: vi.fn(),
      },
      fonts,
      () => undefined,
      homeSpeechView(gameData, fonts.body, undefined, {
        owner: null,
        paragraphs: [gameData.homeText.noticeSoundOff],
      }),
    );
    const notice = f.view();
    notice.element.append(speech.element);
    f.session.replace(notice);
    speech.place(scale);
    expect(f.session.element.contains(speech.element)).toBe(true);
    expect(f.session.element.style.filter).toBe("brightness(0.28)");
    expect(speech.element.style.filter ?? "").toBe("");
    expect(bar.style.filter ?? "").toBe("");
    f.reveals.at(-1)!.settle(true);
    await Promise.resolve();
    await Promise.resolve();
    f.frames.forEach((paint) => paint());
    speech.place(scale);
    expect(f.session.element.style.filter).toBe("brightness(0.28)");
    const images = (speech.element as unknown as FakeElement)
      .all()
      .filter((node) => node.style.backgroundImage);
    expect(images.length).toBeGreaterThan(0);
    expect(images.every((node) => node.style.backgroundImage === 'url("images/ui-quip.png")')).toBe(
      true,
    );
    settings.close();
    expect(f.session.element.style.filter ?? "").toBe("");
    f.session.dispose();
  });
});
