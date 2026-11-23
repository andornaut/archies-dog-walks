import { SOUND_FORMATS } from "../../audio/soundFormat.ts";

const ART_GROUPS = [
  ["start-and-menus", /^\/assets\/art\/dom\/dom-(?:chrome|home|menus)-[^/]+\.(?:json|webp)$/],
  ["cards-and-details", /^\/assets\/art\/dom\/dom-(?:cards|detail)-[^/]+\.(?:json|webp)$/],
  ["walk-hud", /^\/assets\/art\/dom\/dom-walk-[^/]+\.(?:json|webp)$/],
  ["bitmap-font-metrics", /^\/assets\/art\/fonts\/[^/]+\.fnt$/],
  ["web-fonts", /^\/assets\/art\/fonts\/[^/]+\.woff$/],
  ["site-gallery-illustrations", /^\/art\/images\/[^/]+\.png$/],
  ["site-home-screenshots", /^\/art\/site\/[^/]+\.png$/],
  ["art-registry", /^\/assets\/art\/manifest-[^/]+\.json$/],
] as const;
const SOUND_EFFECT = /^\/assets\/art\/sounds\/sfx-([^/]+)$/;
const ICON = /^\/(?:assets\/)?icons\/[^/]+\.png$/;

interface ArchiveGroup {
  readonly name: string;
  readonly members: readonly string[];
}

interface PackingPlan {
  readonly groups: readonly ArchiveGroup[];
  // The producer can alias these only when the complete bodies match.
  readonly iconUrls: readonly string[];
}

export function soundBankId(url: string): string | undefined {
  const effect = SOUND_EFFECT.exec(url)?.[1];
  if (effect !== undefined) {
    const format = SOUND_FORMATS.find((candidate) => effect.endsWith(`.${candidate}`));
    if (format !== undefined) {
      return `${/^(?:hit|debuff)-/.test(effect) ? "contact" : "other"}-${format}`;
    }
  }
  return undefined;
}

function archiveName(url: string): string | undefined {
  return soundBankId(url) ?? ART_GROUPS.find(([, matches]) => matches.test(url))?.[0];
}

// Plans groups over the final public URLs, after the art, site and update producers emit them.
// Keep the manifest's logical URLs, music, the game bundles and the road atlases independent.
export function planPackedAssets(urls: Iterable<string>): PackingPlan {
  const groups = new Map<string, string[]>();
  const iconUrls: string[] = [];
  for (const url of [...new Set(urls)].sort()) {
    if (ICON.test(url)) {
      iconUrls.push(url);
      continue;
    }
    const name = archiveName(url);
    if (name !== undefined) {
      const members = groups.get(name) ?? [];
      members.push(url);
      groups.set(name, members);
    }
  }
  return {
    groups: [...groups.keys()].sort().map((name) => ({ members: groups.get(name)!, name })),
    iconUrls,
  };
}
