import { describe, expect, it } from "vitest";

import { linkedArtFiles, publicCopies } from "./publicFilesPlugin.ts";

describe("linkedArtFiles", () => {
  it.each([
    ['<img src="/art/images/logo.png" alt="">', ["art/images/logo.png"]],
    ["<img src=/art/site/home-road.png>", ["art/site/home-road.png"]],
    ['<link rel="icon" href="/art/images/icon.png?v=2">', ["art/images/icon.png"]],
    ['background: url("/art/sprites/ui-check.png") -48px 0;', ["art/sprites/ui-check.png"]],
    ["background:url(/art/images/backdrop.png) no-repeat", ["art/images/backdrop.png"]],
    ['<a href="/art/">Gallery</a>', []],
    ["<code>/art/manifest.json</code>", []],
  ])("reads %s as %j", (text, paths) => {
    expect([...linkedArtFiles([text])]).toEqual(paths);
  });
});

describe("publicCopies", () => {
  const files = [
    "art/images/logo.png",
    "art/index.html",
    "art/manifest.json",
    "art/sprites/dog.png",
    "manifest.webmanifest",
    "nav.css",
  ];

  it("copies every file outside art/ and, under it, the pages and the linked files", () => {
    expect(publicCopies(new Set(["art/images/logo.png"]), new Set(), files)).toEqual([
      "art/images/logo.png",
      "art/index.html",
      "manifest.webmanifest",
      "nav.css",
    ]);
  });

  it("leaves a file the build output writes to the output", () => {
    expect(publicCopies(new Set(), new Set(["manifest.webmanifest"]), files)).toEqual([
      "art/index.html",
      "nav.css",
    ]);
  });

  it("fails for a linked file the public directory lacks", () => {
    expect(() => publicCopies(new Set(["art/images/gone.png"]), new Set(), files)).toThrow(
      "a page names /art/images/gone.png, which the public directory does not hold",
    );
  });
});
