import { createOriginMemberReader } from "@andornaut/game-kit/runtime/web/pwa/dom/originMemberReader";

import { type PackedAssetIndex, SOUND_BANK_META } from "../assets/packedAssetIndex.ts";
import { browserSoundFormat } from "./soundFormat.ts";

let prepared = new Map<string, string>();

// Load the installed bank for the chosen codec. Music remains independently fetched. Phaser
// receives ordinary object URLs and decodes each cue through its existing loader.
export async function prepareSoundBanks(): Promise<void> {
  const format = browserSoundFormat();
  if (!import.meta.env.PROD || format === undefined) {
    return;
  }
  const source = document.querySelector<HTMLMetaElement>(
    `meta[name="${SOUND_BANK_META}-${format}"]`,
  )?.content;
  if (source === undefined) {
    throw new Error("Sound bank index URL unavailable");
  }
  const response = await fetch(source);
  if (!response.ok || response.body === null) {
    throw new Error("Sound bank index unavailable");
  }
  const decoded = new Response(response.body.pipeThrough(new DecompressionStream("gzip")));
  const { index, urls } = (await decoded.json()) as PackedAssetIndex;
  const liveBanks = new Map(
    Object.entries(urls).filter(
      ([, url]) => url.startsWith("/assets/art/sounds/bank-") && url.endsWith(`.${format}`),
    ),
  );
  const reader = createOriginMemberReader(
    {
      async readArchive(path) {
        const url = liveBanks.get(path);
        const archive = url === undefined ? undefined : await fetch(url);
        return archive?.ok ? (archive.body ?? undefined) : undefined;
      },
    },
    index,
  );
  const selected = [...index.members].sort((a, b) =>
    a.archiveSha256.localeCompare(b.archiveSha256),
  );
  const loaded = await Promise.all(
    selected.map(async ({ path }) => {
      const sound = await reader.read(path);
      if (sound === undefined) {
        throw new Error(`Missing sound bank cue ${path}`);
      }
      const cue = path
        .replace(/^\/assets\/art\//, "")
        .replace(/-[A-Za-z0-9_-]{8}(?=\.(?:ogg|m4a)$)/, "");
      return [cue, await sound.blob()] as const;
    }),
  );
  for (const url of prepared.values()) {
    URL.revokeObjectURL(url);
  }
  prepared = new Map(loaded.map(([path, bytes]) => [path, URL.createObjectURL(bytes)]));
}

export function preparedSoundUrl(path: string): string | undefined {
  return prepared.get(path);
}
