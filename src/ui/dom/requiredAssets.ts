import { loadSheet } from "./sheetFrames.ts";

export type RequiredAssetStatus = "failed" | "loading" | "ready";
// An image to decode, a DOM sheet's JSON to load, or the art cut from the sheets for CSS (cut, in
// requiredAssets), which url names.
export interface RequiredAsset {
  readonly kind: "cuts" | "image" | "sheet";
  readonly url: string;
}

interface Entry {
  readonly asset: RequiredAsset;
  status: RequiredAssetStatus;
  image?: HTMLImageElement;
}

// Startup resources are strict; optional view art keeps its settlement-based reveal policy. cut
// cuts the art CSS draws whole from its sheets, rejecting where any cut failed; a retry calls it
// again.
export function requiredAssets(
  doc: Document,
  changed: () => void,
  cut: () => Promise<void> = () => Promise.resolve(),
) {
  const entries = new Map<string, Entry>();
  let disposed = false;
  const register = (assets: readonly RequiredAsset[]) => {
    if (disposed) {
      return;
    }
    const fresh: Entry[] = [];
    for (const asset of assets) {
      if (!entries.has(asset.url)) {
        const added: Entry = { asset, status: "loading" };
        entries.set(asset.url, added);
        fresh.push(added);
      }
    }
    if (fresh.length > 0) {
      changed();
      for (const entry of fresh) {
        if (disposed) {
          break;
        }
        start(entry);
      }
    }
  };
  const load = async (entry: Entry) => {
    const { kind, url } = entry.asset;
    if (kind === "image") {
      const image = doc.createElement("img");
      entry.image = image;
      image.src = url;
      await image.decode();
    } else if (kind === "sheet") {
      await loadSheet(url);
    } else {
      await cut();
    }
  };
  const start = (entry: Entry) => {
    entry.status = "loading";
    void load(entry).then(
      () => {
        if (!disposed) {
          entry.status = "ready";
          changed();
        }
      },
      () => {
        if (!disposed) {
          entry.status = "failed";
          changed();
        }
      },
    );
  };
  return {
    add: register,
    dispose() {
      disposed = true;
      entries.clear();
    },
    failed: () =>
      [...entries.values()]
        .filter(({ status }) => status === "failed")
        .map(({ asset }) => asset.url),
    retry() {
      if (disposed) {
        return;
      }
      let retried = false;
      for (const entry of entries.values()) {
        if (entry.status === "failed") {
          start(entry);
          retried = true;
        }
      }
      if (retried) {
        changed();
      }
    },
    status: (): RequiredAssetStatus =>
      [...entries.values()].some(({ status }) => status === "failed")
        ? "failed"
        : [...entries.values()].every(({ status }) => status === "ready")
          ? "ready"
          : "loading",
  };
}
