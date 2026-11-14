import type { OfflinePlayOptions } from "@andornaut/game-kit/web/pwa/dom/offlinePlay";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { StorageState } from "../save/profile.ts";
import { PHONE_EVENTS } from "./events.ts";

const {
  accept,
  arriveHome,
  dismissOffer,
  launchReady,
  offline,
  registrationReady,
  requireNewer,
  setOfferVisible,
} = vi.hoisted(() => ({
  accept: vi.fn().mockResolvedValue("blocked"),
  arriveHome: vi.fn(),
  dismissOffer: vi.fn(),
  launchReady: vi.fn().mockResolvedValue("continue"),
  offline: { options: undefined as OfflinePlayOptions | undefined },
  registrationReady: vi.fn(),
  requireNewer: vi.fn(),
  setOfferVisible: vi.fn(),
}));

vi.mock("@andornaut/game-kit/web/pwa/dom/offlinePlay", () => ({
  browserOfflinePage: () => ({}),
  startOfflinePlay: (options: OfflinePlayOptions) => {
    offline.options = options;
    return {
      flow: { accept, arriveHome, dismissOffer, requireNewer, setOfferVisible },
      launchReady,
      registrationReady,
    };
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
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

beforeEach(async () => {
  vi.resetModules();
  accept.mockReset().mockResolvedValue("blocked");
  dismissOffer.mockClear();
  phone = await import("./index.ts");
  await phone.setupPhoneApp();
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

describe("setupPhoneApp", () => {
  it.each(["blocked", "continue", "reloading"] as const)(
    "returns the kit's %s launch decision before game boot",
    async (result) => {
      launchReady.mockClear();
      launchReady.mockResolvedValueOnce(result);
      await expect(phone.setupPhoneApp()).resolves.toBe(result);
      expect(launchReady).toHaveBeenCalledOnce();
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

describe("acceptUpdate", () => {
  async function progress() {
    const { loadingProgress } = await import("../scenes/loadingProgress.ts");
    let snapshot = { active: false, value: undefined as number | undefined };
    loadingProgress.subscribe((value) => {
      snapshot = value;
    })();
    return snapshot;
  }

  it.each(["blocked", "rejected"] as const)(
    "shows a wait immediately, then offers a retry when %s",
    async (result) => {
      let settle = () => undefined as void;
      const pending = new Promise<"blocked" | "reloading">((resolve, reject) => {
        settle =
          result === "blocked" ? () => resolve("blocked") : () => reject(new Error("unavailable"));
      });
      accept.mockImplementationOnce(() => {
        offline.options?.onUpdateShown(false);
        return pending;
      });
      offline.options?.onUpdateShown(true);
      phone.acceptUpdate();
      expect(phone.updateAccepting()).toBe(true);
      expect(phone.updatePlateShown()).toBe(false);
      expect(await progress()).toEqual({ active: true, value: undefined });
      phone.acceptUpdate();
      expect(accept).toHaveBeenCalledOnce();
      expect(dismissOffer).not.toHaveBeenCalled();
      settle();
      await Promise.resolve();
      expect(phone.updateAccepting()).toBe(false);
      expect(phone.updateAcceptanceFailed()).toBe(true);
      expect(phone.updatePlateShown()).toBe(true);
      expect((await progress()).active).toBe(false);
      phone.acceptUpdate();
      expect(accept).toHaveBeenCalledTimes(2);
      await Promise.resolve();
      phone.dismissUpdateOffer();
      expect(phone.updateAcceptanceFailed()).toBe(false);
      expect(dismissOffer).toHaveBeenCalledOnce();
    },
  );

  it("retains the wait after a reload request, without claiming that the new document loaded", async () => {
    accept.mockResolvedValueOnce("reloading");
    phone.acceptUpdate();
    await Promise.resolve();
    expect(phone.updateAccepting()).toBe(true);
    expect(phone.updateAcceptanceFailed()).toBe(false);
    expect(await progress()).toEqual({ active: true, value: undefined });
    phone.acceptUpdate();
    expect(accept).toHaveBeenCalledOnce();
  });

  it("does not start an optional switch while a newer save requires an update", () => {
    offline.options?.onRequireNewer("updating");
    phone.acceptUpdate();
    expect(accept).not.toHaveBeenCalled();
    expect(phone.updateAccepting()).toBe(false);
  });
});
