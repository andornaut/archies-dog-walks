import {
  validateBuildManifest,
  validateBuildPointer,
} from "@andornaut/game-kit/build/buildManifest";
import { BUILD_POINTER_URL } from "@andornaut/game-kit/runtime/web/pwa/buildContract";
import {
  createGroupArchiveMemberReader,
  type GroupArchiveMemberReader,
} from "@andornaut/game-kit/runtime/web/pwa/dom/groupArchiveMemberReader";

import { COMMON_RULE } from "../headers/securityPolicy.ts";

type AssetBinding = { fetch: (request: Request) => Promise<Response> };

function archivedRange(
  range: string,
  size: number,
): [number, number] | "unsatisfiable" | undefined {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(range);
  if (match === null || (match[1] === "" && match[2] === "")) {
    return undefined;
  }
  const suffix = match[1] === "";
  const start = suffix ? Math.max(0, size - Number(match[2])) : Number(match[1]);
  const end = suffix || match[2] === "" ? size - 1 : Math.min(size - 1, Number(match[2]));
  return start >= size || start > end ? "unsatisfiable" : [start, end];
}

async function memberResponse(
  request: Request,
  response: Response,
  digest: string,
): Promise<Response> {
  const path = new URL(request.url).pathname;
  const headers = new Headers(response.headers);
  for (const [name, value] of COMMON_RULE.headers) {
    headers.set(name, value);
  }
  headers.set(
    "Cache-Control",
    path.startsWith("/assets/")
      ? "public, max-age=31536000, immutable"
      : "public, max-age=0, must-revalidate",
  );
  headers.set("Accept-Ranges", "bytes");
  const etag = `"${digest}"`;
  headers.set("ETag", etag);
  const cached = request.headers.get("If-None-Match")?.split(/\s*,\s*/) ?? [];
  if (cached.some((value) => value === "*" || value.replace(/^W\//, "") === etag)) {
    headers.delete("Content-Length");
    return new Response(null, { headers, status: 304 });
  }

  if (request.method === "HEAD") {
    return new Response(null, { headers });
  }
  const range = request.headers.get("Range");
  const ifRange = request.headers.get("If-Range");
  if (range === null || (ifRange !== null && ifRange !== etag)) {
    return new Response(response.body, { headers });
  }
  const size = Number(headers.get("Content-Length"));
  const selection = archivedRange(range, size);
  if (selection === undefined) {
    return new Response(response.body, { headers });
  }
  if (selection === "unsatisfiable") {
    headers.set("Content-Range", `bytes */${size}`);
    headers.set("Content-Length", "0");
    return new Response(null, { headers, status: 416 });
  }
  const [start, end] = selection;
  headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  headers.set("Content-Length", String(end - start + 1));
  const body = (await response.arrayBuffer()).slice(start, end + 1);
  return new Response(body, { headers, status: 206 });
}

interface Origin {
  // Each archived member's SHA-256, by URL, from the deployed build manifest.
  readonly digests: ReadonlyMap<string, string>;
  readonly reader: GroupArchiveMemberReader;
}

// The Cloudflare Worker, which runs only for a request no static file answers. It serves the
// deployed build's archive-only members (src/tools/pwa/precachePlugin.ts) at their URLs from its group
// archives, for a page with no installed build to serve them: the art gallery, the game before
// it installs, or a browser that plays from the network. The binding opens this deployment's
// immutable files directly, without forwarding the client's Range or dispatching through this
// Worker again. One reader per instance keeps the pointer's archive index and its one verified
// archive; a failure to build it is retried on the next request.
let origin: Promise<Origin> | undefined;

async function openOrigin(assets: AssetBinding, requestUrl: string): Promise<Origin> {
  const json = async (path: string) => {
    const response = await assets.fetch(new Request(new URL(path, requestUrl)));
    if (!response.ok) {
      throw new Error(`${path} unavailable`);
    }
    return response.json() as Promise<unknown>;
  };
  const pointer = validateBuildPointer(await json(BUILD_POINTER_URL));
  // The reader requests each group's compressed file (/.game-kit/group-<sha256>.bin) and decodes
  // and verifies it before it serves a member.
  const reader = createGroupArchiveMemberReader(
    {
      async readArchive(path) {
        const response = await assets.fetch(new Request(new URL(path, requestUrl)));
        return response.ok ? (response.body ?? undefined) : undefined;
      },
    },
    pointer,
  );
  const manifest = validateBuildManifest(await json(pointer.manifest));
  return { digests: new Map(manifest.files.map(({ sha256, url }) => [url, sha256])), reader };
}

export default {
  async fetch(request: Request, { ASSETS }: { ASSETS: AssetBinding }): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return ASSETS.fetch(request);
    }
    try {
      origin ??= openOrigin(ASSETS, request.url).catch((error: unknown) => {
        origin = undefined;
        throw error;
      });
      const { digests, reader } = await origin;
      const path = new URL(request.url).pathname;
      const response = await reader.read(path);
      const digest = digests.get(path);
      if (response === undefined || digest === undefined) {
        return await ASSETS.fetch(request);
      }
      return await memberResponse(request, response, digest);
    } catch {
      return new Response("Archived asset unavailable", {
        headers: { "Cache-Control": "no-store" },
        status: 502,
      });
    }
  },
};
