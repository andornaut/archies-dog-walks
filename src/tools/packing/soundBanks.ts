import { gzipSync } from "node:zlib";

import { contentHash } from "@andornaut/game-kit/build/contentHash";
import { buildOriginMemberPacks } from "@andornaut/game-kit/build/originMemberPacks";
import { originMemberArchivePath } from "@andornaut/game-kit/runtime/web/pwa/originMemberIndex";

import { type PackedAssetIndex, SOUND_BANK_INDEX_KEY } from "../../assets/packedAssetIndex.ts";
import { SOUND_FORMATS } from "../../audio/soundFormat.ts";
import { type HashedArtFile, hashedArtFileName } from "../atlas/hashedArt.ts";
import { soundBankId } from "./plan.ts";

export function buildSoundBanks(hashed: readonly HashedArtFile[]) {
  const groups: Record<string, string[]> = {};
  const inputs = hashed.flatMap(({ fileName, source }) => {
    const path = `/${fileName}`;
    const bank = soundBankId(path);
    if (bank === undefined) {
      return [];
    }
    (groups[bank] ??= []).push(path);
    return [
      { bytes: source, contentType: bank.endsWith("-ogg") ? "audio/ogg" : "audio/mp4", path },
    ];
  });
  const { archives, index } = buildOriginMemberPacks({ groups }, inputs);
  const named = new Map(archives.map(({ bytes, path }) => [path, bytes]));
  const members = new Map(index.members.map((member) => [member.path, member]));
  const urls: Record<string, string> = {};
  const alternatives: Record<string, string[]> = {};
  const files = ["contact", "other"].flatMap((role) =>
    SOUND_FORMATS.map((format) => {
      const first = groups[`${role}-${format}`]?.[0];
      const member = first === undefined ? undefined : members.get(first);
      if (member === undefined) {
        throw new Error(`Missing ${role} sound bank for ${format}`);
      }
      const path = originMemberArchivePath(member.archiveSha256);
      const source = named.get(path);
      if (source === undefined) {
        throw new Error(`Missing sound bank body for ${path}`);
      }
      // The shared installer uses the suffix to select one codec. Only the bank reader sees
      // these exact gzip bytes. Phaser receives the original encoded bytes of each cue.
      const fileName = hashedArtFileName(`sounds/bank-${role}.${format}`, contentHash(source));
      const url = `/${fileName}`;
      urls[path] = url;
      (alternatives[`/art/sounds/bank-${role}`] ??= []).push(url);
      return { fileName, source };
    }),
  );
  const indexes = SOUND_FORMATS.map((format) => {
    const matchingUrls = Object.fromEntries(
      Object.entries(urls).filter(([, url]) => url.endsWith(`.${format}`)),
    );
    const included = (sha256: string) => originMemberArchivePath(sha256) in matchingUrls;
    const metadata: PackedAssetIndex = {
      index: {
        archives: index.archives.filter(({ sha256 }) => included(sha256)),
        members: index.members.filter(({ archiveSha256 }) => included(archiveSha256)),
        schema: 1,
      },
      urls: matchingUrls,
    };
    const source = gzipSync(JSON.stringify(metadata), { level: 9 });
    source[9] = 255;
    const fileName = hashedArtFileName(`sounds/bank-index.${format}`, contentHash(source));
    return { fileName, format, source };
  });
  alternatives[SOUND_BANK_INDEX_KEY] = indexes.map(({ fileName }) => `/${fileName}`);
  return { alternatives, files: [...files, ...indexes], indexes };
}
