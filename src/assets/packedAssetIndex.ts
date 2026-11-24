import type { OriginMemberIndex } from "@andornaut/game-kit/runtime/web/pwa/originMemberIndex";

export const SOUND_BANK_META = "archie-sound-banks";
export const SOUND_BANK_INDEX_KEY = "/art/sounds/bank-index";
export const ORIGIN_INDEX_URL = "/.game-kit/origin-member-index.json";

export interface PackedAssetIndex {
  readonly index: OriginMemberIndex;
  readonly urls: Readonly<Record<string, string>>;
}
