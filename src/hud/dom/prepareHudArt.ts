import { DOM_DIM_ART_KEYS, domArtPath } from "../../assets/domArt.ts";
import { dimArtPath } from "../../ui/dimArt.ts";
import type { DomArtSource } from "../../ui/dom/artElements.ts";
import type { RequiredAsset } from "../../ui/dom/requiredAssets.ts";

export interface HudArtDescriptor {
  readonly key: string;
  readonly kind: "image" | "sheet";
}

// The same URL declaration serves optional prewarming and the strict startup resource barrier.
export function hudArtResources(
  source: Pick<DomArtSource, "artUrl">,
  assets: readonly HudArtDescriptor[],
): readonly RequiredAsset[] {
  const resources = assets.flatMap(({ key, kind }) => [
    ...(kind === "sheet"
      ? [{ kind: "sheet" as const, url: source.artUrl(domArtPath(kind, key, "json")) }]
      : []),
    { kind: "image" as const, url: source.artUrl(domArtPath(kind, key, "png")) },
    ...(DOM_DIM_ART_KEYS.has(key)
      ? [{ kind: "image" as const, url: source.artUrl(dimArtPath(kind, key)) }]
      : []),
  ]);
  return [...new Map(resources.map((resource) => [resource.url, resource])).values()];
}

// Optional prewarming retains its rejection contract; startup registers the same resources
// with the strict barrier, which owns failure reporting and failed-only retries.
export async function prepareHudArt(
  source: DomArtSource,
  assets: readonly HudArtDescriptor[],
): Promise<readonly string[]> {
  const resources = hudArtResources(source, assets);
  await Promise.all(
    resources.filter(({ kind }) => kind === "sheet").map(({ url }) => source.loadSheet(url)),
  );
  return resources.filter(({ kind }) => kind === "image").map(({ url }) => url);
}
