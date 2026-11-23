import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildManifestUrl } from "@andornaut/game-kit/runtime/web/pwa/buildContract";
import { expect, it, vi } from "vitest";

import { ORIGIN_INDEX_URL } from "../../assets/packedAssetIndex.ts";
import { retainPreviousBuild } from "./retainedBuild.ts";

it("carries a live build and its predecessor forward without copying a shared body twice", async () => {
  const live = "1111111111111111";
  const previous = "2222222222222222";
  const older = "3333333333333333";
  const path = "/assets/sfx-aaaaaaaa.ogg";
  const oldPath = "/assets/sfx-bbbbbbbb.ogg";
  const body = "retained cue";
  const file = {
    byteSize: body.length,
    sha256: createHash("sha256").update(body).digest("hex"),
    url: path,
  };
  const responses = new Map([
    ["/.game-kit/build.json", JSON.stringify({ version: live })],
    [ORIGIN_INDEX_URL, JSON.stringify({ retainedVersions: [previous, older] })],
    [buildManifestUrl(live), JSON.stringify({ files: [file], version: live })],
    [
      buildManifestUrl(previous),
      JSON.stringify({ files: [file, { ...file, url: oldPath }], version: previous }),
    ],
    [path, body],
    [oldPath, body],
  ]);
  const fetch = vi.fn((url: URL) => {
    const data = responses.get(url.pathname);
    return new Response(data, { status: data === undefined ? 404 : 200 });
  });
  vi.stubGlobal("fetch", fetch);
  const output = await mkdtemp(join(tmpdir(), "archie-retained-build-"));
  try {
    const result = await retainPreviousBuild(output, new URL("https://archie.example"));
    expect(result.versions).toEqual([live, previous]);
    expect(result.files.map(({ bytes, path }) => [path, bytes.toString()])).toEqual([
      [path, body],
      [oldPath, body],
    ]);
    expect(fetch.mock.calls.filter(([url]) => url.pathname === path)).toHaveLength(1);
    expect(await readFile(join(output, buildManifestUrl(previous)), "utf8")).toBe(
      responses.get(buildManifestUrl(previous)),
    );
  } finally {
    vi.unstubAllGlobals();
    await rm(output, { force: true, recursive: true });
  }
});
