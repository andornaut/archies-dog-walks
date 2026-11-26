import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

it("does not reuse browser URL overrides for new runs in an app window", async () => {
  const mode = { matches: false };
  vi.stubGlobal("window", { matchMedia: () => mode, navigator: {} });
  vi.stubGlobal("location", { search: "?dev=1&invincible=1&money=500&seed=7&speed=3&zone=2" });
  const { pageRunSetup } = await import("./pageRunSetup.ts");
  const browserSetup = pageRunSetup();
  expect(browserSetup.setup).toMatchObject({
    dev: true,
    invincible: true,
    money: 500,
    seed: 7,
    speed: 3,
    zone: 2,
  });
  mode.matches = true;
  const appSetup = pageRunSetup();
  expect(appSetup.setup).toEqual({
    dev: false,
    invincible: false,
    seed: expect.any(Number),
    speed: 1,
    zone: 1,
  });
  expect(pageRunSetup()).toBe(appSetup);
  mode.matches = false;
  expect(pageRunSetup()).toBe(browserSetup);
});

it("clears used browser overrides from the cached setup and address without losing history state", async () => {
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }), navigator: {} });
  vi.stubGlobal("location", {
    href: "https://example.test/play/?dev=1&money=500&seed=7&speed=3&zone=2",
    search: "?dev=1&money=500&seed=7&speed=3&zone=2",
  });
  const state = { from: "start" };
  const replaceState = vi.fn();
  vi.stubGlobal("history", { replaceState, state });
  vi.spyOn(Math, "random").mockReturnValue(0);
  const { clearRunOverrides, pageRunSetup } = await import("./pageRunSetup.ts");
  const before = pageRunSetup();
  clearRunOverrides();
  const after = pageRunSetup();
  expect(after).not.toBe(before);
  expect(after).toEqual({
    setup: { dev: true, invincible: false, seed: 0, speed: 1, zone: 1 },
    warnings: [],
  });
  expect(pageRunSetup()).toBe(after);
  expect(replaceState).toHaveBeenCalledExactlyOnceWith(
    state,
    "",
    "https://example.test/play/?dev=1",
  );
});
