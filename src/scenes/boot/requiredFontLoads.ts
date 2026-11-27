import type { LoaderWatch, LoadFailure } from "@andornaut/game-kit/runtime/load/phaser/watchLoader";

import { type AssetManifest, type AtlasManifest, atlasPageKey } from "../../assets/index.ts";
import { fontXmlKey, MANIFEST_CACHE_KEY } from "../../assets/phaser/index.ts";

export const REQUIRED_BITMAP_FONTS = [
  "font-body",
  "font-display",
  "font-display-cream",
  "font-title",
] as const;

interface FailureKey {
  readonly key: string;
  readonly type: string;
}

const isManifest = ({ key, type }: FailureKey) => type === "json" && key === MANIFEST_CACHE_KEY;
const requiredNames: ReadonlySet<string> = new Set(REQUIRED_BITMAP_FONTS);

// Only actual native font dependencies block entry; an unavailable atlas manifest keeps its raw fallback.
export function requiredFontFailure(
  manifest: Pick<AssetManifest, "fonts">,
  atlas: AtlasManifest | undefined,
  failure: FailureKey,
): boolean {
  if (isManifest(failure)) {
    return true;
  }
  const fonts = manifest.fonts.filter(({ key }) => requiredNames.has(key));
  if (failure.type === "bitmapFont") {
    return fonts.some(({ key }) => key === failure.key);
  }
  if (failure.type === "xml") {
    return fonts.some(({ key }) => fontXmlKey(key) === failure.key);
  }
  return (
    failure.type === "image" &&
    fonts.some(({ key }) =>
      atlas?.textures.some(
        (texture) => texture.key === key && atlasPageKey(texture.page) === failure.key,
      ),
    )
  );
}

// Staged loads must not bypass a failed required page by queueing another member of that page.
export function blockedFontAtlas(
  context: {
    readonly atlas: AtlasManifest | undefined;
    readonly failures: readonly FailureKey[];
    readonly manifest: Pick<AssetManifest, "fonts">;
  },
  key: string,
): boolean {
  const texture = context.atlas?.textures.find((entry) => entry.key === key);
  return (
    texture !== undefined &&
    context.failures.some(
      (failure) =>
        failure.type === "image" &&
        failure.key === atlasPageKey(texture.page) &&
        requiredFontFailure(context.manifest, context.atlas, failure),
    )
  );
}

// A deferred font is a first load, not a new attempt at an already recorded failure.
export function unqueuedFonts(
  context: {
    readonly atlas: AtlasManifest | undefined;
    readonly failures: readonly FailureKey[];
    readonly queued: ReadonlySet<string>;
  },
  manifest: Pick<AssetManifest, "fonts">,
): AssetManifest["fonts"] {
  return manifest.fonts.filter(
    (font) =>
      !context.queued.has(font.key) &&
      !blockedFontAtlas({ ...context, manifest }, font.key) &&
      !context.failures.some((failure) =>
        requiredFontFailure({ fonts: [font] }, context.atlas, failure),
      ),
  );
}

// A recovered manifest can introduce the first font loads; settled retries still require cache checks.
export async function retryRequiredFontLoads(
  context: {
    readonly isCurrent: () => boolean;
    readonly recoverManifest: () => Promise<void>;
    readonly required: (failure: LoadFailure) => boolean;
  },
  watch: Pick<LoaderWatch<"boot" | "walk">, "failures" | "retryFailures" | "waitFor">,
): Promise<void> {
  if (!context.isCurrent()) {
    return;
  }
  const failures = watch.failures();
  if (!failures.some(context.required)) {
    return;
  }
  const manifestFailed = failures.some(isManifest);
  watch.waitFor("boot");
  await watch.retryFailures(context.required);
  if (context.isCurrent() && manifestFailed && !watch.failures().some(isManifest)) {
    await context.recoverManifest();
  }
}
