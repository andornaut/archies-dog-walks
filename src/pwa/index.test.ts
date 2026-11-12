import type { OfflinePlayOptions } from "@andornaut/game-kit/web/pwa/dom/offlinePlay";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { StorageState } from "../save/profile.ts";
import { PHONE_EVENTS } from "./events.ts";

const { arriveHome, offline, registrationReady, requireNewer, setOfferVisible } = vi.hoisted(
  () => ({
    arriveHome: vi.fn(),
    offline: { options: undefined as OfflinePlayOptions | undefined },
    registrationReady: vi.fn(),
    requireNewer: vi.fn(),
    setOfferVisible: vi.fn(),
  }),
);

vi.mock("@andornaut/game-kit/web/pwa/dom/offlinePlay", () => ({
  browserOfflinePage: () => ({}),
  startOfflinePlay: (options: OfflinePlayOptions) => {
    offline.options = options;
    return { flow: { arriveHome, requireNewer, setOfferVisible }, registrationReady };
  },
}));
vi.mock("@andornaut/game-kit/web/pwa/dom/installFlow", () => ({
  watchInstall: () => ({ onChange: () => () => undefined, state: () => "steps" }),
}));
vi.mock("@andornaut/game-kit/web/pwa/dom/visibility", () => ({ watchVisibility: () => undefined }));
vi.mock("@andornaut/game-kit/web/pwa/dom/wakeLock", () => ({
  createScreenWakeLock: () => ({ start: () => undefined, stop: () => undefined }),
}));
vi.mock("@andornaut/game-kit/web/pwa/dom/backNavigation", () => ({
  browserCloseWatcher: () => undefined,
  guardBackNavigation: () => undefined,
}));
vi.mock("@andornaut/game-kit/web/pwa/appWindow", () => ({ appCannotClose: () => true }));
vi.mock("@andornaut/game-kit/web/view/dom/watchFrameTurn", () => ({
  lockGameOrientation: () => undefined,
  watchFrameTurn: () => ({ onChange: () => () => undefined, turn: () => 0 }),
}));
vi.mock("@andornaut/game-kit/web/save/dom/localSaveStorage", () => ({
  localSaveStorage: () => ({
    read: () => Promise.resolve(undefined),
    write: () => Promise.resolve(),
  }),
}));

let phone: typeof import("./index.ts");
const dispatched: string[] = [];

beforeAll(async () => {
  vi.stubEnv("PROD", true);
  vi.stubGlobal("document", { createElement: () => ({ canPlayType: () => "" }) });
  vi.stubGlobal("screen", {});
  vi.stubGlobal("window", { dispatchEvent: (event: Event) => dispatched.push(event.type) });
  phone = await import("./index.ts");
  phone.setupPhoneApp();
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  dispatched.length = 0;
  registrationReady.mockClear();
  requireNewer.mockClear();
  setOfferVisible.mockClear();
  arriveHome.mockClear();
});

describe("setOnHomeScreen", () => {
  const setOnHomeScreen = (onHome: boolean) => phone.setOnHomeScreen(onHome);

  it("marks registration ready and shows the offer on arrival home", () => {
    setOnHomeScreen(true);
    expect(registrationReady).toHaveBeenCalledOnce();
    expect(setOfferVisible).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("only hides the offer on leaving home", () => {
    setOnHomeScreen(false);
    expect(registrationReady).not.toHaveBeenCalled();
    expect(setOfferVisible).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("leaves arrivals to arriveHome, so a menu closing over home is not one", () => {
    setOnHomeScreen(true);
    expect(arriveHome).not.toHaveBeenCalled();
    phone.arriveHome();
    expect(arriveHome).toHaveBeenCalledOnce();
  });
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

describe("requiredUpdate", () => {
  it.each(["updating", "unavailable"] as const)(
    "follows the kit's %s report and tells the scenes",
    (state) => {
      offline.options?.onRequireNewer(state);
      expect(phone.requiredUpdate()).toBe(state);
      expect(dispatched).toEqual([PHONE_EVENTS.requiredUpdate]);
    },
  );
});
