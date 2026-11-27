import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { StorageState } from "../save/profile.ts";

const { appCannotClose, createBackNavigationGuard, guard, requireNewer, runsInAppWindow } =
  vi.hoisted(() => ({
    appCannotClose: vi.fn(() => true),
    createBackNavigationGuard: vi.fn(),
    guard: {
      canLeave: vi.fn(() => true),
      dispose: vi.fn(),
      leave: vi.fn(async () => false),
      setEnabled: vi.fn(),
    },
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
  createBackNavigationGuard,
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
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(async () => {
  vi.resetModules();
  appCannotClose.mockReturnValue(true);
  createBackNavigationGuard.mockReset().mockReturnValue(guard);
  Object.values(guard).forEach((mock) => mock.mockClear());
  guard.canLeave.mockReturnValue(true);
  guard.leave.mockResolvedValue(false);
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("history", { length: 1, state: null });
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
      createBackNavigationGuard.mockClear();
      vi.resetModules();
      phone = await import("./index.ts");
      phone.setupPhoneApp();
      expect(phone.exitShown()).toBe(shown);
      expect(createBackNavigationGuard).toHaveBeenCalledExactlyOnceWith(
        {
          createCloseWatcher: undefined,
          history,
          onBack: expect.any(Function),
          stateKey: "archiesDogWalksBackGuard",
          timer: window,
        },
        window,
      );
      expect(guard.setEnabled).toHaveBeenLastCalledWith(true);
      const dispatch = vi.spyOn(window, "dispatchEvent");
      createBackNavigationGuard.mock.calls[0]![0].onBack();
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "back-pressed" }));
      dispatch.mockRestore();
    },
  );
});

it("retains one document guard through repeated setup and BFCache restoration", () => {
  phone.setupPhoneApp();
  expect(createBackNavigationGuard).toHaveBeenCalledOnce();
  const pageEvent = (type: string, persisted: boolean) =>
    Object.assign(new Event(type), { persisted });
  window.dispatchEvent(pageEvent("pagehide", true));
  expect(guard.dispose).not.toHaveBeenCalled();
  window.dispatchEvent(pageEvent("pageshow", true));
  expect(guard.setEnabled).toHaveBeenLastCalledWith(true);
  expect(createBackNavigationGuard).toHaveBeenCalledOnce();
  window.dispatchEvent(pageEvent("pagehide", false));
  expect(guard.dispose).toHaveBeenCalledOnce();
});

it("delegates platform departure to Kit without disabling the scope or adding a fallback", async () => {
  guard.canLeave.mockReturnValue(false);
  expect(phone.canLeaveFromBack()).toBe(false);
  guard.leave.mockResolvedValue(false);
  expect(await phone.leaveFromBack()).toBe(false);
  expect(guard.leave).toHaveBeenCalledOnce();
  expect(guard.setEnabled).not.toHaveBeenCalledWith(false);
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
