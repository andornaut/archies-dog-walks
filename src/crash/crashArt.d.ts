// crashArtPlugin (src/tools/crashArtPlugin.ts) inlines the crash screen's art as data: URLs, so
// the screen draws without loading a file.
declare module "virtual:adw-crash-art" {
  const art: {
    readonly face: string;
    readonly facePressed: string;
    readonly pose: string;
    readonly sound: string;
  };
  export default art;
}
