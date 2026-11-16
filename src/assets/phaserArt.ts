// Native chrome keeps its authored files and metadata without a second Phaser texture.
const NATIVE_ONLY_KEYS: ReadonlySet<string> = new Set([
  "icon-close",
  "icon-exit",
  "icon-menu",
  "icon-pause",
  "icon-sound",
  "ui-button",
  "ui-icon-button",
  "ui-icon-button-normal",
  "ui-icon-button-pressed",
  "ui-scroll-thumb",
  "ui-scroll-track",
]);

// Packing, loading, fallback and registration share this exact renderer-role boundary.
export function usesPhaserArt(key: string): boolean {
  return !NATIVE_ONLY_KEYS.has(key);
}
