import { createProgressState } from "@andornaut/game-kit/progressState";
import { afterEach, expect, it, vi } from "vitest";

import { SCREEN_CONFIG } from "../../data/screen.ts";
import { FakeDocument } from "../../testing/fakeDom.ts";
import { LOADING_BAR_HEIGHT, mountDomLoadingBar } from "./domLoadingBar.ts";

afterEach(() => vi.unstubAllGlobals());

it.each([1, 2])(
  "keeps one top loading widget three CSS pixels tall at DPR%d and after resize",
  (dpr) => {
    vi.stubGlobal("devicePixelRatio", dpr);
    let resized!: () => void;
    const disconnect = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resized = callback;
        }
        disconnect = disconnect;
        observe() {}
      },
    );
    class ProgressDocument extends FakeDocument {
      override createElement(tag: string) {
        return Object.assign(super.createElement(tag), { dataset: {} });
      }
    }
    const doc = new ProgressDocument();
    const parent = Object.assign(doc.createElement("div"), { clientWidth: 575 });
    const source = createProgressState();
    const widget = mountDomLoadingBar(source, parent as unknown as HTMLElement);
    const view = parent.children[0]!;
    const bar = view.children[0]!;
    const task = source.begin();
    task.progress(0.5);
    expect(bar.getAttribute("aria-valuenow")).toBe("0.5");
    expect(parent.all().filter((node) => node.getAttribute("role") === "progressbar")).toEqual([
      bar,
    ]);
    expect(view.style).toMatchObject({
      height: `${LOADING_BAR_HEIGHT}px`,
      left: "0px",
      top: "0px",
      transform: `scaleX(${575 / SCREEN_CONFIG.width})`,
    });
    expect(bar.style.height).toBe(`${LOADING_BAR_HEIGHT}px`);
    parent.clientWidth = 390;
    resized();
    expect(widget.element).toBe(view);
    expect(view.style.transform).toBe(`scaleX(${390 / SCREEN_CONFIG.width})`);
    expect(view.style.height).toBe("3px");
    task.finish();
    widget.dispose();
    widget.dispose();
    expect(parent.children).toEqual([]);
    expect(disconnect).toHaveBeenCalledOnce();
  },
);
