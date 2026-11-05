import { storageFixture } from "@andornaut/game-kit/testing/storageFixture";
import type { InstallState } from "@andornaut/game-kit/web/pwa/installState";
import { describe, expect, it } from "vitest";

import { createInstallNudge, INSTALL_NUDGE_KEY } from "./installNudge.ts";

describe("createInstallNudge", () => {
  it.each<[InstallState, boolean]>([
    ["prompt", true],
    ["installed", false],
  ])("is due for %s on a device that has not seen it: %s", async (state, expected) => {
    const nudge = createInstallNudge(storageFixture());
    await nudge.ready;
    expect(nudge.due(state)).toBe(expected);
  });

  it("shows once per device, remembered across launches", async () => {
    const storage = storageFixture();
    const first = createInstallNudge(storage);
    expect(first.due("prompt")).toBe(false);
    await first.ready;
    first.markShown();
    expect(first.due("prompt")).toBe(false);
    await Promise.resolve();
    expect(storage.entries.has(INSTALL_NUDGE_KEY)).toBe(true);
    const next = createInstallNudge(storage);
    await next.ready;
    expect(next.due("prompt")).toBe(false);
  });

  it("never shows when the flag cannot be read, and stays shown when it cannot be written", async () => {
    const blocked = createInstallNudge(storageFixture({ unavailable: true }));
    await blocked.ready;
    expect(blocked.due("prompt")).toBe(false);

    const once = createInstallNudge(storageFixture({ quota: 0 }));
    await once.ready;
    once.markShown();
    expect(once.due("prompt")).toBe(false);
  });
});
