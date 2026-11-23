import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  BUILD_POINTER_URL,
  buildManifestUrl,
} from "@andornaut/game-kit/runtime/web/pwa/buildContract";

import { ORIGIN_INDEX_URL } from "../../assets/packedAssetIndex.ts";
import { limitConcurrency } from "../concurrency.ts";

const immutableAsset =
  /^\/assets\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+-[A-Za-z0-9_-]{8}\.[A-Za-z0-9]+$/;
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const isVersion = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{16}$/.test(value);

// Allow a release already in progress to cross a second deployment. Carry the two most recent
// predecessor manifests and their changed immutable URLs, rather than growing the archive forever.
// This runs in the gate while the live origin still points to the earlier release.
export async function retainPreviousBuild(output: string, origin: URL) {
  const get = (path: string) =>
    fetch(new URL(path, origin), {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
  const read = async (path: string): Promise<Buffer> => {
    const response = await get(path);
    if (!response.ok) {
      throw new Error(`Cannot retain ${path}: HTTP ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  };
  const { version } = JSON.parse((await read(BUILD_POINTER_URL)).toString()) as {
    version?: string;
  };
  if (!isVersion(version)) {
    throw new Error("The previous build has no valid version");
  }
  const catalogue = await get(ORIGIN_INDEX_URL);
  if (!catalogue.ok && catalogue.status !== 404) {
    throw new Error(`Cannot read the previous origin index: HTTP ${catalogue.status}`);
  }
  const inheritance: unknown = catalogue.ok
    ? ((await catalogue.json()) as { retainedVersions?: unknown }).retainedVersions
    : undefined;
  if (inheritance !== undefined && (!Array.isArray(inheritance) || !inheritance.every(isVersion))) {
    throw new Error("The previous origin index has invalid retained versions");
  }
  const versions = [...new Set([version, ...(inheritance ?? [])])].slice(0, 2);
  type File = { byteSize: number; sha256: string; url: string };
  const manifests = await Promise.all(
    versions.map(async (retained) => {
      const path = buildManifestUrl(retained);
      const body = await read(path);
      const manifest = JSON.parse(body.toString()) as { files: readonly File[]; version: string };
      if (manifest.version !== retained || !Array.isArray(manifest.files)) {
        throw new Error("A retained build manifest does not match its version");
      }
      const target = join(output, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, body);
      return manifest.files;
    }),
  );
  const files = new Map<string, File>();
  for (const file of manifests.flat()) {
    const existing = files.get(file.url);
    if (
      existing !== undefined &&
      existing.sha256 !== file.sha256 &&
      immutableAsset.test(file.url)
    ) {
      throw new Error(`Retained builds disagree on immutable URL ${file.url}`);
    }
    files.set(file.url, file);
  }
  const retain = limitConcurrency(4, async ({ byteSize, sha256, url }: File) => {
    if (!immutableAsset.test(url) || new URL(url, origin).pathname !== url) {
      return [];
    }
    const local = await readFile(join(output, url)).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
      return undefined;
    });
    const body = local ?? (await read(url));
    if (body.byteLength !== byteSize || digest(body) !== sha256) {
      throw new Error(`Previous build body verification failed for ${url}`);
    }
    return local === undefined ? [{ bytes: body, path: url }] : [];
  });
  return {
    files: (await Promise.all([...files.values()].map((file) => retain(file)))).flat(),
    versions,
  };
}
