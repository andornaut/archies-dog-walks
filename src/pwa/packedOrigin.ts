import {
  createOriginMemberReader,
  type OriginMemberReader,
} from "@andornaut/game-kit/runtime/web/pwa/dom/originMemberReader";

import { ORIGIN_INDEX_URL, type PackedAssetIndex } from "../assets/packedAssetIndex.ts";
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

// The binding always opens the immutable bytes of this deployment directly, without forwarding the
// client's Range or dispatching through this Worker again. Retained files can remain ordinary assets.
async function readerFor(assets: AssetBinding, requestUrl: string) {
  const read = (path: string) => assets.fetch(new Request(new URL(path, requestUrl)));
  const index = await read(ORIGIN_INDEX_URL);
  if (!index.ok) {
    throw new Error("Packed asset index unavailable");
  }
  const { index: members, urls } = (await index.json()) as PackedAssetIndex;
  const reader: OriginMemberReader = createOriginMemberReader(
    {
      async readArchive(path) {
        const response = await read(urls[path] ?? path);
        return response.ok ? (response.body ?? undefined) : undefined;
      },
    },
    members,
  );
  return { members: members.members, reader };
}

export default {
  async fetch(request: Request, { ASSETS }: { ASSETS: AssetBinding }): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return ASSETS.fetch(request);
    }
    try {
      const { members, reader } = await readerFor(ASSETS, request.url);
      const path = new URL(request.url).pathname;
      const entry = members.find((member) => member.path === path);
      if (entry === undefined) {
        return await ASSETS.fetch(request);
      }
      const response = await reader.read(path);
      if (response === undefined) {
        throw new Error("Packed asset missing from verified index");
      }
      return await memberResponse(request, response, entry.sha256);
    } catch {
      return new Response("Packed asset unavailable", {
        headers: { "Cache-Control": "no-store" },
        status: 502,
      });
    }
  },
};
