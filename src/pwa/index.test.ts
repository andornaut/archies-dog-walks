import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { registrationReady, setOfferVisible } = vi.hoisted(() => ({
  registrationReady: vi.fn(),
  setOfferVisible: vi.fn(),
}));

vi.mock("@andornaut/game-kit/web/pwa/dom/offlinePlay", () => ({
  browserOfflinePage: () => ({}),
  startOfflinePlay: () => ({
    flow: { setOfferVisible },
    registrationReady,
  }),
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

describe("setOnHomeScreen", () => {
  let setOnHomeScreen: (onHome: boolean) => void;

  beforeAll(async () => {
    vi.stubEnv("PROD", true);
    vi.stubGlobal("document", { createElement: () => ({ canPlayType: () => "" }) });
    vi.stubGlobal("screen", {});
    vi.stubGlobal("window", {});
    const phone = await import("./index.ts");
    phone.setupPhoneApp();
    setOnHomeScreen = phone.setOnHomeScreen;
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    registrationReady.mockClear();
    setOfferVisible.mockClear();
  });

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
});
