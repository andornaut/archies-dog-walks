import { expect, it, vi } from "vitest";

const { base, factory } = vi.hoisted(() => {
  vi.resetModules();
  const base = {
    plugins: [{ name: "configured-plugin" }],
    root: "/configured-pages",
    test: {
      environment: "node",
      exclude: ["configured-exclusion"],
      include: ["library-default-tests"],
      testTimeout: 30_000,
    },
  };
  return { base, factory: vi.fn(async () => base) };
});
vi.mock("@andornaut/game-kit/web/build/vite/gameConfig", () => ({ gameViteConfig: factory }));

it("discovers only game source tests while preserving the configured plugins and test options", async () => {
  const { default: config } = await import("../../vite.config.ts");
  const resolved = await config;
  expect(factory).toHaveBeenCalledOnce();
  expect(factory).toHaveBeenCalledWith(
    expect.objectContaining({
      pages: {
        main: "pages/index.html",
        play: "pages/play/index.html",
        tuning: "pages/tuning/index.html",
      },
    }),
  );
  expect(resolved.test).toEqual({
    ...base.test,
    include: ["src/**/*.test.ts"],
    server: { deps: { inline: ["@andornaut/game-kit"] } },
  });
  expect(resolved.plugins).toBe(base.plugins);
  expect(resolved.root).toBe(base.root);
});
