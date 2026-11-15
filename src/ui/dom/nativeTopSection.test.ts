import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { gameData } from "../../data/index.ts";
import { FakeDocument, fakeLayer, type FakeTarget } from "../../testing/fakeDom.ts";
import { gameFont } from "../../testing/fontInk.ts";
import { domScale } from "../domScale.ts";
import { topSectionLayout } from "../topSection.ts";
import { createNativeTopSection } from "./nativeTopSection.ts";

const labels = {
  help: gameData.menuText.pause.help,
  menu: gameData.menuText.menu.title,
  mute: gameData.menuText.settings.sound,
  pause: gameData.menuText.pause.title,
};

function fixture() {
  const doc = new FakeDocument();
  const { element, layer } = fakeLayer(doc, domScale(1, { height: 560, width: 360, x: 0, y: 0 }));
  let reveal: (ready: boolean) => void = () => undefined;
  const revealed = new Promise<boolean>((resolve) => {
    reveal = resolve;
  });
  const cancel = vi.fn(() => reveal(false));
  Object.assign(layer, { onReady: () => () => undefined, reveal: () => ({ cancel, revealed }) });
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
      buttons: ["mute", "menu"],
      currency: true,
      labels,
      press,
    },
  );
  const buttons = element.all().filter((node) => node.tagName === "button");
  const click = () =>
    buttons[0]?.fire(
      "click",
      Object.assign(
        {
          preventDefault: () => undefined,
          stopPropagation: () => undefined,
        },
        { detail: 0, stopImmediatePropagation: () => undefined },
      ),
    );
  return { buttons, cancel, click, doc, element, layer, press, reveal, view };
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
}

describe("native top section integration", () => {
  it("keeps the shared control order and art geometry while gating native actions on reveal", async () => {
    const { buttons, click, press, reveal } = fixture();
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      labels.mute,
      labels.menu,
    ]);
    const shared = topSectionLayout(["mute", "menu"]);
    expect(buttons.map((button) => button.style.width)).toEqual(
      shared.controls.map(([, control]) => `${control.hit.width}px`),
    );
    click();
    expect(press).not.toHaveBeenCalled();
    reveal(true);
    await Promise.resolve();
    click();
    expect(press).toHaveBeenCalledExactlyOnceWith("mute", {
      completedAt: undefined,
      startedAt: undefined,
      via: "keyboard",
    });
  });

  it("keeps a hidden or covered section inactive and disposes its pending reveal", async () => {
    const { buttons, cancel, click, doc, element, layer, press, reveal, view } = fixture();
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
    dispatch(button, "pointerdown", { buttons: 1, pointerId: 1, target: button });
    const covered = layer.input.open();
    covered.close();
    dispatch(doc, "pointerup", { pointerId: 1, target: button });
    dispatch(button, "click", { detail: 1, target: button });
    expect(press).toHaveBeenCalledTimes(1);
    view.dispose();
    view.dispose();
    click();
    expect(press).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(element.children).toEqual([]);
  });

  it("updates currency and mute state without replacing controls", () => {
    const { buttons, element, view } = fixture();
    view.setAmount("999999999", "999K");
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
