import { installCrashScreen } from "@andornaut/game-kit/runtime/web/crash/dom/crashScreen";
import { afterEach, expect, it, vi } from "vitest";

import palette from "../../shared/palette.json" with { type: "json" };
import { MENU_TEXT } from "../data/menuText.ts";

vi.mock("@andornaut/game-kit/runtime/web/crash/dom/crashScreen", () => ({
  installCrashScreen: vi.fn(),
}));
vi.mock("virtual:art-files", () => ({
  default: new Map([["sprites/face-dog-archie.png", "assets/art/face-dog-archie-test.png"]]),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

it("installs the kit crash screen with the game words, palette and portrait", async () => {
  const setProperty = vi.fn();
  vi.stubGlobal("document", { documentElement: { style: { setProperty } } });
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }), navigator: {} });
  vi.stubGlobal("location", { search: "" });
  const screen = { stopGameOnCrash: vi.fn() };
  vi.mocked(installCrashScreen).mockReturnValueOnce(screen);
  const { CRASH_SCREEN } = await import("./crashScreen.ts");
  expect(CRASH_SCREEN).toBe(screen);
  expect(installCrashScreen).toHaveBeenCalledWith(window, {
    buildLabel: expect.any(String),
    colours: {
      background: `#${palette.ink.hex}`,
      buttonFace: `#${palette.green.hex}`,
      buttonLip: `#${palette.forest.hex}`,
      ink: `#${palette.ink.hex}`,
      text: `#${palette.cream.hex}`,
    },
    dev: false,
    words: MENU_TEXT.crash,
  });
  expect(setProperty.mock.calls).toEqual([
    ["--crash-paper", `#${palette.cream.hex}`],
    ["--crash-paper-lip", `#${palette.tan.hex}`],
    ["--crash-paper-text", `#${palette.plum.hex}`],
    ["--crash-pose-image", 'url("/assets/art/face-dog-archie-test.png")'],
  ]);
});

it("keeps crash recovery independent when the optional sound endpoint cannot mount", async () => {
  vi.stubGlobal("document", { documentElement: { style: { setProperty: vi.fn() } } });
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }), navigator: {} });
  vi.stubGlobal("location", { search: "" });
  const { observeCrashMute } = await import("./crashScreen.ts");
  const observe = vi.fn();
  const disconnect = vi.fn();
  let changed: (() => void) | undefined;
  vi.stubGlobal(
    "MutationObserver",
    class {
      constructor(callback: () => void) {
        changed = callback;
      }
      observe = observe;
      disconnect = disconnect;
    },
  );
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const doc = { body: { querySelector: () => ({}) } } as unknown as Document;
  const stop = observeCrashMute(doc);
  expect(observe).toHaveBeenCalledWith(doc.body, { childList: true });
  expect(() => changed?.()).not.toThrow();
  expect(disconnect).toHaveBeenCalledOnce();
  expect(warn).toHaveBeenCalledOnce();
  stop();
  expect(disconnect).toHaveBeenCalledTimes(2);
  warn.mockRestore();
});
