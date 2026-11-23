import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { StorageState } from "../save/profile.ts";

const { appCannotClose, guardBackNavigation, requireNewer, runsInAppWindow } = vi.hoisted(() => ({
  appCannotClose: vi.fn(() => true),
  guardBackNavigation: vi.fn(),
  requireNewer: vi.fn(),
  runsInAppWindow: vi.fn(() => false),
}));

vi.mock("./launch.ts", () => ({ requireNewer }));
vi.mock("@andornaut/game-kit/runtime/web/pwa/dom/installFlow", () => ({
  watchInstall: () => ({ onChange: () => () => undefined, state: () => "steps" }),
}));
vi.mock("@andornaut/game-kit/runtime/web/pwa/dom/visibility", () => ({
  watchVisibility: () => undefined,
}));
vi.mock("@andornaut/game-kit/runtime/web/pwa/dom/wakeLock", () => ({
  createScreenWakeLock: () => ({ start: () => undefined, stop: () => undefined }),
}));
vi.mock("@andornaut/game-kit/runtime/web/pwa/dom/backNavigation", () => ({
  browserCloseWatcher: () => undefined,
  guardBackNavigation,
}));
vi.mock("@andornaut/game-kit/runtime/web/pwa/appWindow", () => ({
  appCannotClose,
  // The kit's canExitApp: an installed app window that a script can close.
  canExitApp: () => runsInAppWindow() && !appCannotClose(),
}));
vi.mock("@andornaut/game-kit/runtime/web/view/dom/watchFrameTurn", () => ({
  lockGameOrientation: () => undefined,
  watchFrameTurn: () => ({ onChange: () => () => undefined, turn: () => 0 }),
}));
vi.mock("@andornaut/game-kit/runtime/web/save/dom/localSaveStorage", () => ({
  localSaveStorage: () => ({
    read: () => Promise.resolve(undefined),
    write: () => Promise.resolve(),
  }),
}));

let phone: typeof import("./index.ts");

beforeAll(() => {
  vi.stubGlobal("document", { createElement: () => ({ canPlayType: () => "" }) });
  vi.stubGlobal("screen", {});
  vi.stubGlobal("window", { dispatchEvent: () => true });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(async () => {
  vi.resetModules();
  appCannotClose.mockReturnValue(true);
  guardBackNavigation.mockClear();
  runsInAppWindow.mockReturnValue(false);
  requireNewer.mockClear();
  phone = await import("./index.ts");
  phone.setupPhoneApp();
});

describe("setupPhoneApp", () => {
  it.each([
    ["a browser tab, where leaving would navigate away", false, false, false],
    ["an installed app whose window closes", true, false, true],
    ["an installed app that cannot close", true, true, false],
  ] as const)(
    "in %s, shows Exit only where leaving closes the app",
    async (_, inApp, cannotClose, shown) => {
      runsInAppWindow.mockReturnValue(inApp);
      appCannotClose.mockReturnValue(cannotClose);
      // Offering to leave guards back, which reads the session history.
      vi.stubGlobal("history", { length: 1, state: null });
      vi.resetModules();
      phone = await import("./index.ts");
      phone.setupPhoneApp();
      expect(phone.exitShown()).toBe(shown);
      if (cannotClose) {
        expect(guardBackNavigation).not.toHaveBeenCalled();
      } else {
        expect(guardBackNavigation).toHaveBeenCalledExactlyOnceWith(
          {
            createCloseWatcher: undefined,
            history,
            onBack: expect.any(Function),
            stateKey: "archiesDogWalksBackGuard",
            timer: window,
          },
          window,
        );
        const dispatch = vi.spyOn(window, "dispatchEvent");
        guardBackNavigation.mock.calls[0]![0].onBack();
        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "back-pressed" }));
        dispatch.mockRestore();
      }
    },
  );
});

describe("noteSaveStorage", () => {
  it.each<[StorageState, number]>([
    ["available", 0],
    ["newer", 1],
    ["unavailable", 0],
  ])("for %s storage requires the newer version %i times", (storage, calls) => {
    phone.noteSaveStorage(storage);
    expect(requireNewer).toHaveBeenCalledTimes(calls);
  });
});
