import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

it("does not reuse browser URL overrides for new runs in an app window", async () => {
  const mode = { matches: false };
  vi.stubGlobal("window", { matchMedia: () => mode, navigator: {} });
  vi.stubGlobal("location", { search: "?dev=1&money=500&seed=7&speed=3&zone=2" });
  const { pageRunSetup } = await import("./pageRunSetup.ts");
  const browserSetup = pageRunSetup();
  expect(browserSetup.setup).toMatchObject({ dev: true, money: 500, seed: 7, speed: 3, zone: 2 });
  mode.matches = true;
  const appSetup = pageRunSetup();
  expect(appSetup.setup).toEqual({ dev: false, seed: expect.any(Number), speed: 1, zone: 1 });
  expect(pageRunSetup()).toBe(appSetup);
  mode.matches = false;
  expect(pageRunSetup()).toBe(browserSetup);
});
