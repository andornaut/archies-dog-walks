import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { webManifestJson } from "./webManifestPlugin.ts";

const WEB_MANIFEST = new URL("../../public/manifest.webmanifest", import.meta.url);

describe("webManifestJson", () => {
  it("fills the manifest's description from the data and leaves the rest as written", async () => {
    const template = await readFile(WEB_MANIFEST, "utf8");
    const rendered: Record<string, unknown> = JSON.parse(webManifestJson(gameData, template));
    expect(rendered).toEqual({
      ...JSON.parse(template),
      description: gameData.menuText.settings.installDescription,
    });
  });

  it("fails for a manifest without the description placeholder", () => {
    expect(() => webManifestJson(gameData, '{ "description": "Walk dogs." }')).toThrow(
      /%INSTALL_DESCRIPTION%/u,
    );
  });
});
