import { expect, it, vi } from "vitest";

import { precachePlugin } from "./precachePlugin.ts";

const { shared } = vi.hoisted(() => ({ shared: vi.fn(() => ({ name: "shared-precache" })) }));
vi.mock("@andornaut/game-kit/build/precachePlugin", () => ({ precachePlugin: shared }));

it.each([
  ["eligible clean source", "0123456789abcdef0123456789abcdef01234567"],
  ["ineligible local source", undefined],
] as const)("forwards %s identity unchanged to the shared precache plugin", (_source, buildId) => {
  shared.mockClear();
  const plugins = precachePlugin({
    buildId,
    getArtFiles: () => new Map(),
    pageHtmlFile: "play/index.html",
    serviceWorkerSource: "/source/serviceWorker.ts",
  });
  expect(shared).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ buildId }));
  expect(plugins).toContainEqual({ name: "shared-precache" });
});
