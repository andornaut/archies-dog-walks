import { readFileSync } from "node:fs";

import { PENDING_ATTRIBUTE } from "@andornaut/game-kit/web/ui/dom/imageReady";
import { describe, expect, it, vi } from "vitest";

import { gameData } from "../../data/index.ts";
import { FakeDocument, fakeLayer, type FakeTarget } from "../../testing/fakeDom.ts";
import { gameFont } from "../../testing/fontInk.ts";
import { domScale } from "../domScale.ts";
import { topSectionLayout } from "../topSection.ts";
import { createNativeTopSection } from "./nativeTopSection.ts";
const labels = {
  menu: gameData.menuText.menu.title,
  mute: gameData.menuText.settings.sound,
  pause: gameData.menuText.pause.title,
};
function fixture(activation: "click" | "down" = "click", effects = 0) {
  const doc = new FakeDocument();
  const { element, layer } = fakeLayer(doc, domScale(1, { height: 560, width: 360, x: 0, y: 0 }));
  let pendingRoot: HTMLElement | undefined;
  let resolveReveal: (ready: boolean) => void = () => undefined;
  const revealed = new Promise<boolean>((resolve) => {
    resolveReveal = resolve;
  });
  const reveal = (ready: boolean) => {
    if (ready) {
      pendingRoot?.removeAttribute(PENDING_ATTRIBUTE);
    }
    resolveReveal(ready);
  };
  const cancel = vi.fn(() => reveal(false));
  Object.assign(layer, {
    onReady: () => () => undefined,
    reveal: (_urls: unknown, root: HTMLElement) => {
      pendingRoot = root;
      root.setAttribute(PENDING_ATTRIBUTE, "");
      return { cancel, revealed };
    },
  });
  const press = vi.fn();
  const view = createNativeTopSection(
    layer,
    {
      artUrl: (path) => path,
      loadSheet: async (path) => JSON.parse(readFileSync(`public/art/${path}`, "utf8")),
    },
    gameFont("font-title"),
    {
      accepts: () => true,
      activation,
      buttons: ["mute", "menu"],
      currency: true,
      effects,
      labels,
      press,
    },
  );
  const buttons = element.all().filter((node) => node.tagName === "button");
  const root = view.element as unknown as FakeTarget;
  const click = () => {
    const fields = { detail: 0, target: buttons[0] };
    if (!dispatch(root, "click", fields)) {
      dispatch(buttons[0]!, "click", fields);
    }
  };
  return { buttons, cancel, click, doc, element, layer, press, reveal, root, view };
}
function dispatch(target: FakeTarget, type: string, fields: Record<string, unknown>) {
  let stopped = false;
  const event = Object.assign(
    {
      buttons: 0,
      detail: 0,
      pointerId: 1,
      preventDefault: () => undefined,
      stopImmediatePropagation: () => {
        stopped = true;
      },
      stopPropagation: () => undefined,
      timeStamp: 0,
      type,
    },
    fields,
  );
  for (const listener of target.listeners.get(type) ?? []) {
    listener(event);
    if (stopped) {
      break;
    }
  }
  return stopped;
}
describe("native top section integration", () => {
  it("keeps the shared control order and art geometry while gating native actions on reveal", async () => {
    const { buttons, click, press, reveal, view } = fixture();
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      labels.mute,
      labels.menu,
    ]);
    const shared = topSectionLayout(["mute", "menu"]);
    expect(buttons.map((button) => button.style.width)).toEqual(
      shared.controls.map(([, control]) => `${control.hit.width}px`),
    );
    view.setInputBottom(40);
    expect(buttons.map((button) => button.style.height)).toEqual(["40px", "40px"]);
    view.setInputBottom(undefined);
    expect(buttons.map((button) => button.style.height)).toEqual(["48px", "48px"]);
    click();
    expect(press).not.toHaveBeenCalled();
    reveal(true);
    await Promise.resolve();
    click();
    expect(press).toHaveBeenCalledExactlyOnceWith("mute", {
      completedAt: 0,
      startedAt: undefined,
      via: "keyboard",
    });
  });
  it("keeps a hidden or covered section inactive and disposes its pending reveal", async () => {
    const { buttons, cancel, click, doc, element, layer, press, reveal, root, view } = fixture();
    reveal(true);
    await Promise.resolve();
    view.setInert(true);
    click();
    view.setInert(false);
    view.setShown(false);
    click();
    expect(press).not.toHaveBeenCalled();
    view.setShown(true);
    click();
    expect(press).toHaveBeenCalledTimes(1);
    const button = buttons[0]!;
    dispatch(root, "pointerdown", { buttons: 1, pointerId: 1, target: button });
    const covered = layer.input.open();
    covered.close();
    dispatch(doc, "pointerup", { pointerId: 1, target: button });
    const clickFields = { detail: 1, target: button };
    if (!dispatch(root, "click", clickFields)) {
      dispatch(button, "click", clickFields);
    }
    expect(press).toHaveBeenCalledTimes(1);
    view.dispose();
    view.dispose();
    click();
    expect(press).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(element.children).toEqual([]);
  });
  it("admits only one pointer across separate bar controls", async () => {
    const { buttons, doc, layer, press, reveal, root } = fixture("down");
    reveal(true);
    await Promise.resolve();
    const elsewhere = layer.press.claim();
    dispatch(root, "pointerdown", { buttons: 1, pointerId: 0, target: buttons[0] });
    expect(press).not.toHaveBeenCalled();
    elsewhere?.release();
    dispatch(root, "pointerdown", { buttons: 1, pointerId: 1, target: buttons[0] });
    dispatch(root, "pointerdown", { buttons: 1, pointerId: 2, target: buttons[1] });
    expect(press).toHaveBeenCalledTimes(1);
    dispatch(doc, "pointerup", { pointerId: 1, target: buttons[0] });
    dispatch(doc, "pointerup", { pointerId: 2, target: buttons[1] });
    dispatch(root, "pointerdown", { buttons: 1, pointerId: 3, target: buttons[1] });
    expect(press).toHaveBeenLastCalledWith("menu", {
      completedAt: 0,
      startedAt: 0,
      via: "pointer",
    });
    expect(press).toHaveBeenCalledTimes(2);
  });
  it("centres only visible effect wells and reuses their native art nodes", () => {
    const { element, view } = fixture("click", 6);
    const wells = element
      .all()
      .filter((node) => node.style.backgroundImage?.includes("ui-hud-effect-well"));
    expect(wells).toHaveLength(6);
    expect(wells.every((node) => node.hidden)).toBe(true);
    view.setEffectCount(2);
    expect(
      wells
        .filter((node) => !node.hidden)
        .map((node) => [node.style.left, node.style.top, node.style.width]),
    ).toEqual([
      ["148px", "6px", "26px"],
      ["176px", "6px", "26px"],
    ]);
    view.setEffectCount(6);
    expect(wells.filter((node) => !node.hidden).map((node) => node.style.left)).toEqual([
      "92px",
      "120px",
      "148px",
      "176px",
      "204px",
      "232px",
    ]);
    view.setEffectCount(0);
    expect(wells.every((node) => node.hidden)).toBe(true);
    expect(() => view.setEffectCount(7)).toThrow("configured top section");
  });
  it("updates currency and mute state without replacing controls", () => {
    const { buttons, element, view } = fixture();
    view.setAmount("9".repeat(16), "999K");
    expect(
      element
        .all()
        .filter((node) => node.className.includes("adw-text"))
        .map((node) => node.textContent),
    ).toContain("999K");
    view.setMuted(true);
    expect(buttons[0]?.getAttribute("aria-pressed")).toBe("false");
    expect(element.all().filter((node) => node.tagName === "button")).toEqual(buttons);
  });
});
