import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { gunzipSync } from "node:zlib";

import { buildOriginMemberPacks } from "@andornaut/game-kit/build/originMemberPacks";
import { parseOriginMemberIndex } from "@andornaut/game-kit/runtime/web/pwa/originMemberIndex";
import { build, type Plugin } from "vite";

import {
  ORIGIN_INDEX_URL,
  type PackedAssetIndex,
  SOUND_BANK_INDEX_KEY,
} from "../../assets/packedAssetIndex.ts";
import { planPackedAssets, soundBankId } from "./plan.ts";

const MEDIA_TYPES: Readonly<Record<string, string>> = {
  ".fnt": "text/xml; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff": "font/woff",
};

function contentTypeFor(path: string): string {
  const contentType = MEDIA_TYPES[extname(path)];
  if (contentType === undefined) {
    throw new Error(`No origin MIME policy for ${path}`);
  }
  return contentType;
}

function iconAliases(files: readonly { bytes: Uint8Array; path: string }[]) {
  const hashes = new Map<string, string>();
  const aliases: Record<string, string> = {};
  for (const { bytes, path } of files) {
    const digest = createHash("sha256").update(bytes).digest("hex");
    const first = hashes.get(digest);
    if (first === undefined) {
      hashes.set(digest, path);
    } else {
      aliases[path] = first;
    }
  }
  return { aliases, targets: [...hashes.values()] };
}

async function packFinishedOutput(output: string, bankIndexes: readonly string[]): Promise<void> {
  const read = (path: string) => readFile(join(output, path));
  const paths = (await readdir(output, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => `/${relative(output, join(entry.parentPath, entry.name))}`);
  const sounds = await Promise.all(
    bankIndexes.map(
      async (path) => JSON.parse(gunzipSync(await read(path)).toString()) as PackedAssetIndex,
    ),
  );
  const soundMembers = sounds.flatMap(({ index }) => index.members);
  const planned = planPackedAssets(paths.filter((path) => soundBankId(path) === undefined));
  const icons = await Promise.all(
    planned.iconUrls.map(async (path) => ({ bytes: await read(path), path })),
  );
  const { aliases, targets } = iconAliases(icons);
  const groups = Object.fromEntries(planned.groups.map(({ members, name }) => [name, members]));
  if (targets.length > 0) {
    groups["brand-icons"] = targets;
  }
  const inputs = await Promise.all(
    [...planned.groups.flatMap(({ members }) => members), ...Object.keys(aliases), ...targets].map(
      async (path) => ({ bytes: await read(path), contentType: contentTypeFor(path), path }),
    ),
  );
  const { archives, index } = buildOriginMemberPacks({ aliases, groups }, inputs);
  const combined = parseOriginMemberIndex({
    archives: [...index.archives, ...sounds.flatMap(({ index }) => index.archives)],
    members: [...index.members, ...soundMembers],
    schema: 1,
  });
  await Promise.all(
    archives.map(async ({ bytes, path }) => {
      const file = join(output, path);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, bytes);
    }),
  );
  await writeFile(
    join(output, ORIGIN_INDEX_URL),
    JSON.stringify({
      index: combined,
      urls: Object.assign({}, ...sounds.map(({ urls }) => urls)),
    } satisfies PackedAssetIndex),
  );
  await Promise.all([...inputs, ...soundMembers].map(({ path }) => unlink(join(output, path))));
}

// Closing the parent bundle gives the packer the final outputs of all the site and game plugins.
// The Worker is in the retained gate artifact and is excluded from the public asset directory.
export function packOriginPlugin(
  getSoundBanks: () => Readonly<Record<string, readonly string[]>>,
  workerEntry: string,
): Plugin {
  let output: string;
  return {
    apply: "build",
    async closeBundle() {
      await build({
        build: {
          emptyOutDir: false,
          lib: { entry: workerEntry, fileName: () => "index.mjs", formats: ["es"] },
          outDir: join(output, ".worker"),
        },
        configFile: false,
        logLevel: "warn",
        publicDir: false,
      });
      await packFinishedOutput(output, getSoundBanks()[SOUND_BANK_INDEX_KEY] ?? []);
      await writeFile(join(output, ".assetsignore"), ".worker/\n");
    },
    configResolved(config) {
      output = resolve(config.root, config.build.outDir);
    },
    name: "archies-dog-walks-pack-origin",
  };
}
