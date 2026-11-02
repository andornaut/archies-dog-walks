import { encodeIndexedPng } from "@andornaut/art-kit/indexedPng";
import { encodeRgbaPng } from "@andornaut/art-kit/png";
import type { RgbaImage } from "@andornaut/art-kit/rgbaImage";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { encodePng } from "./atlasBuild";

vi.mock("@andornaut/art-kit/indexedPng", () => ({ encodeIndexedPng: vi.fn() }));
vi.mock("@andornaut/art-kit/png", async (original) => ({
  ...(await original<typeof import("@andornaut/art-kit/png")>()),
  encodeRgbaPng: vi.fn(),
}));

const image: RgbaImage = { data: new Uint8Array([1, 2, 3, 255]), height: 1, width: 1 };
beforeEach(() => {
  vi.mocked(encodeIndexedPng).mockReset();
  vi.mocked(encodeRgbaPng).mockReset();
});

describe("atlas PNG encoding policy", () => {
  it("prefers indexed output with the client compression settings", () => {
    const bytes = new Uint8Array([7]);
    vi.mocked(encodeIndexedPng).mockReturnValue(bytes);
    expect(encodePng(image)).toBe(bytes);
    expect(encodeIndexedPng).toHaveBeenCalledExactlyOnceWith({ level: 9, memLevel: 9 }, image);
    expect(encodeRgbaPng).not.toHaveBeenCalled();
  });

  it("uses the client RGBA settings only when indexed encoding declines", () => {
    const bytes = new Uint8Array([8]);
    vi.mocked(encodeIndexedPng).mockReturnValue(undefined);
    vi.mocked(encodeRgbaPng).mockReturnValue(bytes);
    expect(encodePng(image)).toBe(bytes);
    expect(encodeIndexedPng).toHaveBeenCalledExactlyOnceWith({ level: 9, memLevel: 9 }, image);
    expect(encodeRgbaPng).toHaveBeenCalledExactlyOnceWith(
      { deflateLevel: 9, deflateStrategy: 0, filterType: 0 },
      image,
    );
  });
});
