import { afterEach, expect, it, vi } from "vitest";

import palette from "../../shared/palette.json";
import { MENU_TEXT } from "../data/menuText";
import { installCrashScreen } from "../platform/crash/crashScreen.ts";

vi.mock("../platform/crash/crashScreen.ts", () => ({ installCrashScreen: vi.fn() }));
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
  const { CRASH_SCREEN } = await import("./crashScreen");
  expect(CRASH_SCREEN).toBe(screen);
  expect(installCrashScreen).toHaveBeenCalledWith({
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
