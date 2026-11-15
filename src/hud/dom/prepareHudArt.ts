import { DOM_DIM_ART_KEYS, domArtPath } from "../../assets/domArt.ts";
import { dimArtPath } from "../../ui/dimArt.ts";
import type { DomArtSource } from "../../ui/dom/artElements.ts";

export interface HudArtDescriptor {
  readonly key: string;
  readonly kind: "image" | "sheet";
}

// Sheet metadata must load before native startup readiness. Decoding owns the returned PNG URLs.
export async function prepareHudArt(
  source: DomArtSource,
  assets: readonly HudArtDescriptor[],
): Promise<readonly string[]> {
  const urls = await Promise.all(
    assets.map(async ({ key, kind }) => {
      if (kind === "sheet") {
        await source.loadSheet(source.artUrl(domArtPath(kind, key, "json")));
      }
      return [
        source.artUrl(domArtPath(kind, key, "png")),
        ...(DOM_DIM_ART_KEYS.has(key) ? [source.artUrl(dimArtPath(kind, key))] : []),
      ];
    }),
  );
  return [...new Set(urls.flat())];
}
