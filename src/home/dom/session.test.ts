import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { gameData } from "../../data/index.ts";
import { FakeDocument, type FakeElement, fakeLayer } from "../../testing/fakeDom.ts";
import { gameFont } from "../../testing/fontInk.ts";
import { ownArtFrames } from "../../testing/ownArtFrames.ts";
import { createGameButton } from "../../ui/dom/gameButton.ts";
import { domScale } from "../../ui/domScale.ts";
import { homeSpeechView } from "../speechView.ts";
import type { NativeHomeView } from "./screen.ts";
import { createNativeHomeSession } from "./session.ts";
import { createHomeSpeech } from "./speech.ts";
import { createStartControl } from "./startControl.ts";
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
  // Whether the screen takes input: false while it is paused under an overlay.
  const screen = { active: true };
  const context = {
    accepts: () => screen.active,
    activate: vi.fn(),
    cancel: vi.fn(),
    down: vi.fn(),
    focused: vi.fn(),
    move: vi.fn(),
    painted: vi.fn(),
    up: vi.fn(),
  };
  const session = createNativeHomeSession(layer, context);
  const view = (ids: readonly string[] = ["start"]) => {
    const element = doc.createElement("div");
    const controls = new Map(ids.map((id) => [id, doc.createElement("button")]));
    element.append(...controls.values());
    return {
      controls,
      dispose: vi.fn(() => element.remove()),
      element,
      ready: Promise.resolve([]),
      selections: new Map(),
    } as unknown as NativeHomeView;
  };
  const setActive = (active: boolean) => {
    screen.active = active;
  };
  return { context, doc, frames, layer, reveals, session, setActive, view };
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
      code: "NumpadEnter",
      preventDefault: vi.fn(),
      repeat: true,
      stopPropagation: vi.fn(),
    };
    (f.session.element as unknown as FakeElement).fire("keydown", heldKey);
    expect(heldKey.preventDefault).toHaveBeenCalledOnce();
    expect(heldKey.stopPropagation).toHaveBeenCalledOnce();
    f.session.dispose();
  });
  it("restores a held item's logical invoker only after its replacement is painted", async () => {
    const f = fixture();
    const next = f.view();
    f.doc.body.focus();
    f.session.replace(next, Promise.resolve(), "start");
    expect(f.doc.activeElement).toBe(f.doc.body);
    f.reveals[0]!.settle(true);
    await Promise.resolve();
    f.frames.shift()?.();
    expect(f.doc.activeElement).toBe(next.controls.get("start"));
    f.doc.body.focus();
    f.session.replace(f.view(), Promise.resolve(), "removed-item");
    f.reveals[1]!.settle(true);
    await Promise.resolve();
    f.frames.shift()?.();
    expect(f.doc.activeElement).toBe(f.doc.body);
    f.session.dispose();
  });
  // Each overlay over the Start screen as the screen sees it open and close: paused (holdFocus)
  // or, for a detail card, redrawn with the card open; for Cheats, redrawn and painted while still
  // paused; then, in order, its modal leaving (focus drops to the page), the resume, a redraw
  // after it, or the card's close.
  type Step = "cardCloses" | "modalLeaves" | "redraw" | "resumes";
  const overlays: [string, "card" | "pause", boolean, Step[]][] = [
    ["a detail card", "card", false, ["cardCloses", "modalLeaves"]],
    ["Cheats from the Menu", "pause", true, ["resumes", "modalLeaves"]],
    ["Settings", "pause", false, ["resumes", "modalLeaves", "redraw"]],
    ["the Menu", "pause", false, ["resumes", "modalLeaves"]],
    ["the Update available prompt", "pause", false, ["modalLeaves", "resumes"]],
  ];
  // Cancel, the X, Escape and back close with focus in the modal; a tap outside drops it first.
  const routes: [string, boolean][] = [
    ["Cancel, the X, Escape or back", false],
    ["a tap outside", true],
  ];
  it.each(
    overlays.flatMap(([overlay, opens, pausedRedraw, steps]) =>
      routes.map(([route, outside]) => ({ opens, outside, overlay, pausedRedraw, route, steps })),
    ),
  )("focuses the Start control again after $route closes $overlay", async (row) => {
    const f = fixture();
    const ids = ["dog:archie", "start", "gear:ball"];
    const paint = async () => {
      f.reveals.forEach(({ settle }) => settle(true));
      await Promise.resolve();
      f.frames.splice(0).forEach((frame) => frame());
    };
    const views = [f.view(ids)];
    const current = () => views.at(-1)!;
    const redraw = (restoreFocus?: string) => {
      views.push(f.view(ids));
      f.session.replace(current(), Promise.resolve(), restoreFocus);
    };
    f.session.replace(current());
    await paint();
    current().controls.get("dog:archie")?.focus();
    f.setActive(false);
    if (row.opens === "pause") {
      f.session.holdFocus();
    } else {
      redraw();
      await paint();
    }
    const modal = f.doc.createElement("button");
    f.doc.body.append(modal);
    modal.focus();
    if (row.outside) {
      f.doc.body.focus();
    }
    if (row.pausedRedraw) {
      redraw();
      await paint();
    }
    for (const step of row.steps) {
      switch (step) {
        case "cardCloses":
          f.setActive(true);
          redraw("dog:archie");
          break;
        case "modalLeaves":
          modal.remove();
          f.doc.body.focus();
          break;
        case "redraw":
          redraw();
          break;
        case "resumes":
          f.setActive(true);
          redraw();
          break;
      }
    }
    await paint();
    expect(f.doc.activeElement).toBe(current().controls.get("dog:archie"));
    f.doc.body.focus();
    redraw();
    await paint();
    expect(f.doc.activeElement).toBe(f.doc.body);
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

  it("lets Kit alone handle an admitted Start release and keyboard refusal", async () => {
    const f = fixture();
    const view = f.view();
    const refuse = vi.fn();
    const { sectionDogs, startLoading, startWalk } = gameData.homeText;
    const start = createStartControl(f.doc as unknown as Document, gameFont("font-title"), {
      activate: refuse,
      label: startWalk,
      loading: startLoading,
      unavailable: sectionDogs,
      waitingAlpha: 0.5,
    });
    view.element.replaceChildren(start.element);
    f.session.replace({
      ...view,
      controls: new Map([["start", start.element]]),
      dispose: start.dispose,
      start,
    });
    f.reveals[0]!.settle(true);
    await Promise.resolve();
    f.frames.shift()?.();
    const root = f.session.element as unknown as FakeElement;
    const button = start.element as unknown as FakeElement;
    const event = (type: string, detail: number) => ({
      button: 0,
      detail,
      isPrimary: true,
      pointerId: 1,
      preventDefault: vi.fn(),
      stopImmediatePropagation: vi.fn(),
      target: button,
      type,
    });
    const click = (detail: number) => {
      const action = event("click", detail);
      root.fire("click", action);
      if (action.stopImmediatePropagation.mock.calls.length === 0) {
        button.fire("click", action);
      }
    };
    for (const consumed of [true, false]) {
      f.context.up.mockReturnValueOnce(consumed);
      root.fire("pointerdown", event("pointerdown", 1));
      f.doc.fire("pointerup", event("pointerup", 1));
      click(1);
      expect(refuse).toHaveBeenCalledTimes(consumed ? 0 : 1);
    }
    expect(button.getAttribute("aria-description")).toBe(sectionDogs);
    click(0);
    expect(refuse).toHaveBeenCalledTimes(2);
    expect(f.context.activate).not.toHaveBeenCalled();
    f.session.dispose();
  });

  it("opens a pick's detail on hold and suppresses the matching tap", async () => {
    vi.useFakeTimers();
    try {
      const f = fixture();
      Object.assign(f.doc.defaultView, {
        clearTimeout,
        performance: { now: () => Date.now() },
        setTimeout,
      });
      const activate = vi.fn();
      const detail = vi.fn();
      const selected = "dog:archie";
      const control = createGameButton(f.doc as unknown as Document, {
        content: { kind: "icon", name: gameData.dogs.archie.name },
        getAction: () => ({ activate, hold: detail }),
        skin: "authored",
      });
      const view = f.view();
      view.element.replaceChildren(control.element);
      f.session.replace({
        ...view,
        controls: new Map([[selected, control.element]]),
        dispose: control.dispose,
        selections: new Map([
          [
            selected,
            {
              ...control,
              place: vi.fn(),
              ready: Promise.resolve([]),
              setFrame: vi.fn(),
              setOrbit: vi.fn(),
            },
          ],
        ]),
      });
      f.reveals[0]!.settle(true);
      await Promise.resolve();
      f.frames.shift()?.();
      const target = control.element as unknown as FakeElement;
      const root = f.session.element as unknown as FakeElement;
      const event = (type: string) => ({
        button: 0,
        clientX: 24,
        clientY: 24,
        detail: 1,
        isPrimary: true,
        pointerId: 1,
        preventDefault: vi.fn(),
        stopImmediatePropagation: vi.fn(),
        target,
        type,
      });
      root.fire("pointerdown", event("pointerdown"));
      vi.advanceTimersByTime(gameData.tuning.seconds.holdSeconds * 1000);
      expect(detail).toHaveBeenCalledOnce();
      f.doc.fire("pointerup", event("pointerup"));
      const synthetic = event("click");
      root.fire("click", synthetic);
      expect(synthetic.stopImmediatePropagation).toHaveBeenCalled();
      expect(f.context.up).not.toHaveBeenCalled();
      expect(activate).not.toHaveBeenCalled();
      expect(f.context.activate).not.toHaveBeenCalled();
      f.session.dispose();
    } finally {
      vi.useRealTimers();
    }
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
        loadSheet: vi.fn(async (path: string) => ownArtFrames(path)),
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
