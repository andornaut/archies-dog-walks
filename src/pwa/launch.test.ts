import type { ProgressSnapshot } from "@andornaut/game-kit/runtime/progressState";
import type { UpdateOffer } from "@andornaut/game-kit/runtime/web/pwa/buildContract";
import type { LaunchOptions } from "@andornaut/game-kit/runtime/web/pwa/dom/launch";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PHONE_EVENTS } from "./events.ts";

const kit = vi.hoisted(() => ({
  bootProgress: vi.fn(),
  options: undefined as LaunchOptions | undefined,
  prepare: vi.fn(),
  requestUpdateCheck: vi.fn(),
  requireNewer: vi.fn(),
  run: vi.fn(),
}));

vi.mock("@andornaut/game-kit/runtime/web/pwa/dom/launch", () => ({
  createLaunch: (_context: unknown, options: LaunchOptions) => {
    kit.options = options;
    return {
      bootProgress: kit.bootProgress,
      requestUpdateCheck: kit.requestUpdateCheck,
      requireNewer: kit.requireNewer,
      run: kit.run,
    };
  },
  prepareBrowserLaunch: kit.prepare,
}));

let launch: typeof import("./launch.ts");
const dispatched: string[] = [];
const onUnsupported = () => undefined;

function snapshot(source: {
  subscribe(listener: (next: ProgressSnapshot) => void): () => void;
}): ProgressSnapshot {
  let shown: ProgressSnapshot = { active: false, value: undefined };
  source.subscribe((next) => {
    shown = next;
  })();
  return shown;
}

function options(): LaunchOptions {
  if (kit.options === undefined) {
    throw new Error("The launch was not created");
  }
  return kit.options;
}

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("PROD", true);
  vi.stubGlobal("window", {
    addEventListener: vi.fn(),
    dispatchEvent: (event: Event) => dispatched.push(event.type),
  });
  vi.stubGlobal("document", {
    createElement: () => ({ canPlayType: (type: string) => (type.includes("ogg") ? "" : "maybe") }),
  });
  kit.options = undefined;
  kit.prepare.mockReset().mockReturnValue({ context: {}, kind: "supported" });
  kit.bootProgress.mockClear();
  kit.requireNewer.mockClear();
  kit.requestUpdateCheck.mockClear();
  kit.run.mockReset().mockResolvedValue("play");
  dispatched.length = 0;
  launch = await import("./launch.ts");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("startLaunch", () => {
  it("stops an unsupported production launch before creating the installer", async () => {
    const unsupported = vi.fn();
    const dispose = vi.fn();
    kit.prepare.mockImplementation(({ onUnsupported }: { onUnsupported: () => void }) => {
      onUnsupported();
      return { failure: { dispose }, kind: "unsupported" };
    });
    const mount = vi.fn(() => ({ dispose() {}, update() {} }));

    await expect(launch.startLaunch(mount, unsupported)).resolves.toBe("unsupported");
    expect(unsupported).toHaveBeenCalledOnce();
    expect(mount).not.toHaveBeenCalled();
    expect(kit.run).not.toHaveBeenCalled();
    expect(kit.options).toBeUndefined();
  });

  it("delegates play and Start checks after boot hands over, without app throttling", async () => {
    launch.requestGameUpdateCheck();
    await launch.startLaunch(() => ({ dispose() {}, update() {} }), onUnsupported);
    launch.requestGameUpdateCheck();
    expect(kit.requestUpdateCheck).not.toHaveBeenCalled();
    launch.bootHandedOver();
    launch.requestGameUpdateCheck();
    launch.requestGameUpdateCheck();
    expect(kit.requestUpdateCheck).toHaveBeenCalledTimes(2);
  });

  it("installs only the sound format this page plays", async () => {
    await launch.startLaunch(() => ({ dispose() {}, update() {} }), onUnsupported);
    expect(options().soundFormat).toBe("m4a");
  });

  it("shows a first install's Loading failed with Retry until the launch plays", async () => {
    let resolveRun!: (result: "play") => void;
    kit.run.mockReturnValue(
      new Promise((resolve) => {
        resolveRun = resolve;
      }),
    );
    const view = { dispose: vi.fn(), update: vi.fn() };
    let pressRetry!: () => void;
    const started = launch.startLaunch((retry) => {
      pressRetry = retry;
      return view;
    }, onUnsupported);
    const retry = vi.fn();
    options().onFailure({ reason: "network", retry });
    expect(view.update).toHaveBeenLastCalledWith({ attempt: 1, error: "network", kind: "failed" });
    pressRetry();
    expect(retry).toHaveBeenCalledOnce();
    expect(view.update).toHaveBeenLastCalledWith({ attempt: 1, kind: "loading" });
    resolveRun("play");
    await expect(started).resolves.toBe("play");
    expect(view.dispose).toHaveBeenCalledOnce();
    expect(kit.bootProgress).toHaveBeenCalledExactlyOnceWith(0, 1);
  });

  it.each(["quota", "unsupported"] as const)(
    "plays from the network when the device cannot install (%s), with no Loading failed",
    async (reason) => {
      const mount = vi.fn(() => ({ dispose() {}, update() {} }));
      kit.run.mockImplementation(() => {
        options().onNetworkPlay({ reason });
        return Promise.resolve("play");
      });
      expect(launch.networkPlayReason()).toBeUndefined();
      await expect(launch.startLaunch(mount, onUnsupported)).resolves.toBe("play");
      expect(launch.networkPlayReason()).toBe(reason);
      expect(mount).not.toHaveBeenCalled();
    },
  );

  it("starts the game at once where no launch runs", async () => {
    vi.stubEnv("PROD", false);
    vi.resetModules();
    launch = await import("./launch.ts");
    await expect(
      launch.startLaunch(() => ({ dispose() {}, update() {} }), onUnsupported),
    ).resolves.toBe("play");
    launch.bootHandedOver();
    launch.requestGameUpdateCheck();
    expect(kit.requestUpdateCheck).not.toHaveBeenCalled();
    launch.requireNewer();
    expect(launch.requiredUpdate()).toBe("unavailable");
    expect(kit.options).toBeUndefined();
  });
});

describe("Update now", () => {
  function offer(updateNow: UpdateOffer["updateNow"], version = "next") {
    const dismiss = vi.fn();
    options().onUpdateReady({ dismiss, updateNow, version });
    return dismiss;
  }

  it("saves, then switches, showing a wait, and offers a retry when the switch fails", async () => {
    await launch.startLaunch(() => ({ dispose() {}, update() {} }), onUnsupported);
    const { loadingProgress } = await import("../loadingProgress.ts");
    let fail!: (error: Error) => void;
    const updateNow = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          fail = reject;
        }),
    );
    offer(updateNow);
    expect(launch.updateOffered()).toBe(true);
    expect(dispatched).toContain(PHONE_EVENTS.updateReady);
    const save = vi.fn(() => Promise.resolve());
    launch.acceptUpdate(save);
    launch.acceptUpdate(save);
    expect(updateNow).toHaveBeenCalledExactlyOnceWith(save);
    expect(launch.updateAccepting()).toBe(true);
    expect(snapshot(loadingProgress).active).toBe(true);
    launch.dismissUpdate();
    expect(launch.updateOffered()).toBe(true);
    fail(new Error("no longer staged"));
    await Promise.resolve();
    await Promise.resolve();
    expect(launch.updateAccepting()).toBe(false);
    expect(launch.updateAcceptanceFailed()).toBe(true);
    expect(launch.updateOffered()).toBe(true);
    expect(snapshot(loadingProgress).active).toBe(false);
  });

  it("dismissing continues on this build and leaves the update to the next launch", async () => {
    await launch.startLaunch(() => ({ dispose() {}, update() {} }), onUnsupported);
    const updateNow = vi.fn(() => Promise.resolve());
    const dismiss = offer(updateNow);
    launch.dismissUpdate();
    expect(dismiss).toHaveBeenCalledOnce();
    expect(launch.updateOffered()).toBe(false);
    launch.acceptUpdate(() => Promise.resolve());
    expect(updateNow).not.toHaveBeenCalled();
  });

  it("closes its matching obsolete offer with an idle wait and normal change event", async () => {
    await launch.startLaunch(() => ({ dispose() {}, update() {} }), onUnsupported);
    const { ObsoleteUpdateOfferError } =
      await import("@andornaut/game-kit/runtime/web/pwa/buildContract");
    const { loadingProgress } = await import("../loadingProgress.ts");
    let reject!: (error: Error) => void;
    const updateNow = vi.fn(
      () =>
        new Promise<void>((_resolve, fail) => {
          reject = fail;
        }),
    );
    const dismiss = offer(updateNow);
    const save = vi.fn(() => Promise.resolve());
    launch.acceptUpdate(save);
    expect(snapshot(loadingProgress).active).toBe(true);
    const observed: { accepting: boolean; failed: boolean; loading: boolean; offered: boolean }[] =
      [];
    dispatched.length = 0;
    vi.stubGlobal("window", {
      dispatchEvent: (event: Event) => {
        dispatched.push(event.type);
        if (event.type === PHONE_EVENTS.updateReady) {
          observed.push({
            accepting: launch.updateAccepting(),
            failed: launch.updateAcceptanceFailed(),
            loading: snapshot(loadingProgress).active,
            offered: launch.updateOffered(),
          });
        }
      },
    });
    reject(new ObsoleteUpdateOfferError("next"));
    await Promise.resolve();
    await Promise.resolve();
    expect(observed).toEqual([{ accepting: false, failed: false, loading: false, offered: false }]);
    expect(dispatched).toEqual([PHONE_EVENTS.updateReady]);
    expect(dismiss).not.toHaveBeenCalled();
    launch.acceptUpdate(save);
    expect(updateNow).toHaveBeenCalledExactlyOnceWith(save);
    expect(kit.requestUpdateCheck).not.toHaveBeenCalled();
  });

  it.each([
    { name: "a newer offer", version: "later" },
    { name: "a different object for the same version", version: "next" },
  ])("keeps $name actionable when the accepted object becomes obsolete", async ({ version }) => {
    await launch.startLaunch(() => ({ dispose() {}, update() {} }), onUnsupported);
    const { ObsoleteUpdateOfferError } =
      await import("@andornaut/game-kit/runtime/web/pwa/buildContract");
    const { loadingProgress } = await import("../loadingProgress.ts");
    let reject!: (error: Error) => void;
    const oldUpdateNow = vi.fn(
      () =>
        new Promise<void>((_resolve, fail) => {
          reject = fail;
        }),
    );
    const oldDismiss = offer(oldUpdateNow);
    const save = vi.fn(() => Promise.resolve());
    launch.acceptUpdate(save);
    const replacement = vi.fn(() => Promise.resolve());
    const replacementDismiss = offer(replacement, version);
    dispatched.length = 0;
    reject(new ObsoleteUpdateOfferError("next"));
    await Promise.resolve();
    await Promise.resolve();
    expect(launch.updateOffered()).toBe(true);
    expect(launch.updateAccepting()).toBe(false);
    expect(launch.updateAcceptanceFailed()).toBe(false);
    expect(snapshot(loadingProgress).active).toBe(false);
    expect(dispatched).toEqual([PHONE_EVENTS.updateReady]);
    expect(oldDismiss).not.toHaveBeenCalled();
    expect(replacementDismiss).not.toHaveBeenCalled();
    expect(replacement).not.toHaveBeenCalled();
    launch.acceptUpdate(save);
    expect(replacement).toHaveBeenCalledExactlyOnceWith(save);
    expect(oldUpdateNow).toHaveBeenCalledExactlyOnceWith(save);
  });

  it("retains the accepted offer when an obsolete error names a different version", async () => {
    await launch.startLaunch(() => ({ dispose() {}, update() {} }), onUnsupported);
    const { ObsoleteUpdateOfferError } =
      await import("@andornaut/game-kit/runtime/web/pwa/buildContract");
    const { loadingProgress } = await import("../loadingProgress.ts");
    let reject!: (error: Error) => void;
    const updateNow = vi.fn(
      () =>
        new Promise<void>((_resolve, fail) => {
          reject = fail;
        }),
    );
    const dismiss = offer(updateNow);
    const save = vi.fn(() => Promise.resolve());
    launch.acceptUpdate(save);
    dispatched.length = 0;
    reject(new ObsoleteUpdateOfferError("other"));
    await Promise.resolve();
    await Promise.resolve();
    expect(launch.updateOffered()).toBe(true);
    expect(launch.updateAccepting()).toBe(false);
    expect(launch.updateAcceptanceFailed()).toBe(false);
    expect(snapshot(loadingProgress).active).toBe(false);
    expect(dispatched).toEqual([PHONE_EVENTS.updateReady]);
    expect(dismiss).not.toHaveBeenCalled();
    expect(updateNow).toHaveBeenCalledExactlyOnceWith(save);
    launch.acceptUpdate(save);
    expect(updateNow).toHaveBeenCalledTimes(2);
  });

  it("is refused while a newer save requires an update, which alone shows staging", async () => {
    await launch.startLaunch(() => ({ dispose() {}, update() {} }), onUnsupported);
    const { requiredUpdateProgress } = await import("./requiredUpdate.ts");
    options().onUpdateState({ phase: "staging", value: 0.4, version: "next" });
    expect(snapshot(requiredUpdateProgress).active).toBe(false);
    launch.requireNewer();
    expect(kit.requireNewer).toHaveBeenCalledOnce();
    options().onRequireNewer?.("updating");
    expect(launch.requiredUpdate()).toBe("updating");
    options().onUpdateState({ phase: "staging", value: 0.4, version: "next" });
    expect(snapshot(requiredUpdateProgress)).toEqual({ active: true, value: 0.4 });
    const updateNow = vi.fn(() => Promise.resolve());
    offer(updateNow);
    launch.acceptUpdate(() => Promise.resolve());
    expect(updateNow).not.toHaveBeenCalled();
    options().onUpdateState({ phase: "failed", version: "next" });
    options().onRequireNewer?.("unavailable");
    expect(snapshot(requiredUpdateProgress).active).toBe(false);
  });
});

describe("bootLoad", () => {
  it("counts boot's reads into the launch's value until boot hands over", async () => {
    await launch.startLaunch(() => ({ dispose() {}, update() {} }), onUnsupported);
    kit.bootProgress.mockClear();
    const after = { begin: vi.fn(() => ({ finish: vi.fn(), progress: vi.fn() })) };
    const reads = launch.bootLoad(after).begin();
    reads.progress(0.5);
    reads.progress(undefined);
    reads.finish();
    expect(kit.bootProgress.mock.calls).toEqual([
      [0.5 * launch.BOOT_READS_SHARE, 1],
      [launch.BOOT_READS_SHARE, 1],
    ]);
    expect(launch.bootFinished()).toBe(false);
    launch.bootHandedOver();
    expect(kit.bootProgress).toHaveBeenLastCalledWith(1, 1);
    expect(launch.bootFinished()).toBe(true);
    launch.bootLoad(after).begin();
    expect(after.begin).toHaveBeenCalledOnce();
  });
});
