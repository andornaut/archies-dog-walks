import { createHash } from "node:crypto";

import { createBuildManifest } from "@andornaut/game-kit/build/buildManifest";
import { encodeGroupArchive } from "@andornaut/game-kit/build/groupArchive";
import {
  BUILD_POINTER_URL,
  buildManifestUrl,
} from "@andornaut/game-kit/runtime/web/pwa/buildContract";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ART_URL = "/assets/art/atlas/run-0-Bq3x_9-Z.webp";
const ART = new TextEncoder().encode("run atlas page bytes");
const DIGEST = createHash("sha256").update(ART).digest("hex");
const VERSION = "0123456789abcdef";

// A deployment holding one group archive with one archive-only member, as the build emits it.
function deployment(corrupt = false): Map<string, Uint8Array | string> {
  const { encoded, group, path } = encodeGroupArchive({}, [{ bytes: ART, url: ART_URL }]);
  const manifest = createBuildManifest({
    boot: [],
    buildId: "dev",
    files: [{ byteSize: ART.byteLength, sha256: DIGEST, url: ART_URL }],
    sounds: {},
    version: VERSION,
  });
  const pointer = {
    buildId: "dev",
    groupedFirstInstall: true,
    groups: [group],
    manifest: buildManifestUrl(VERSION),
    schema: 1,
    version: VERSION,
  };
  const body = corrupt ? encoded.map((byte, index) => (index === 20 ? byte ^ 1 : byte)) : encoded;
  return new Map<string, Uint8Array | string>([
    [BUILD_POINTER_URL, JSON.stringify(pointer)],
    [buildManifestUrl(VERSION), JSON.stringify(manifest)],
    [path, body],
  ]);
}

// The static asset binding: a deployed file, or Cloudflare's 404.
function assets(files: Map<string, Uint8Array | string>) {
  return {
    fetch: vi.fn(async (request: Request) => {
      const body = files.get(new URL(request.url).pathname);
      return body === undefined
        ? new Response("Not found", { status: 404 })
        : new Response(typeof body === "string" ? body : new Uint8Array(body));
    }),
  };
}

async function serve(
  files: Map<string, Uint8Array | string>,
  path: string,
  headers: Record<string, string> = {},
) {
  const { default: worker } = await import("./originWorker.ts");
  return worker.fetch(new Request(`https://archie.test${path}`, { headers }), {
    ASSETS: assets(files),
  });
}

describe("originWorker", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("serves an archive-only file from its group archive at its own URL", async () => {
    const response = await serve(deployment(), ART_URL);
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(ART);
    expect(response.headers.get("Content-Type")).toBe("image/webp");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    expect(response.headers.get("ETag")).toBe(`"${DIGEST}"`);
  });

  it.each([
    [{ Range: "bytes=0-2" }, 206, "run"],
    [{ "If-None-Match": `"${DIGEST}"` }, 304, ""],
  ])("answers %o with %i", async (headers, status, text) => {
    const response = await serve(deployment(), ART_URL, headers);
    expect(response.status).toBe(status);
    expect(await response.text()).toBe(text);
  });

  it("leaves a path no group holds to the static files", async () => {
    expect((await serve(deployment(), "/assets/missing-Bq3x_9-Z.js")).status).toBe(404);
  });

  it("refuses a member whose archive fails verification", async () => {
    const response = await serve(deployment(true), ART_URL);
    expect(response.status).toBe(502);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
