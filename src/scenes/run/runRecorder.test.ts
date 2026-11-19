import { afterEach, expect, it, vi } from "vitest";

import { DEV_REPLAY_KEY } from "../../dev/cheats.ts";
import { encodeInputLog, startInputLog } from "../../dev/inputLog.ts";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

// A browser tab at search, its session holding stored.
function stubTab(search: string, stored: Record<string, string> = {}): void {
  const session = new Map(Object.entries(stored));
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }), navigator: {} });
  vi.stubGlobal("location", { search });
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => session.get(key) ?? null,
    removeItem: (key: string) => session.delete(key),
    setItem: (key: string, value: string) => session.set(key, value),
  });
}

it.each([
  ["a run URL", "?invincible=1&seed=3", {}],
  [
    "a replayed log",
    "",
    {
      [DEV_REPLAY_KEY]: encodeInputLog(
        startInputLog({ dev: false, invincible: true, seed: 3, speed: 1, zone: 1 }),
      ),
    },
  ],
])("plays the walk %s sets up with Invincible owners", async (_, search, stored) => {
  stubTab(search, stored);
  const { nextRunStart } = await import("./runRecorder.ts");
  const start = nextRunStart();
  expect(start.setup).toMatchObject({ invincible: true, seed: 3 });
  expect(start.cheats).toEqual({ invincible: true, speed: "normal" });
});
