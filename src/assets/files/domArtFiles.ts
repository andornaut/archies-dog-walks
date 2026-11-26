import { domArtFileUrl } from "../index.ts";
import { artUrl } from "./artFiles.ts";

// The URL a DOM art file's logical path (domArtPath) loads from: its key's DOM sheet's image or
// copy, or its frames on the sheet's JSON, through this build's hashed art.
export function domArtUrl(path: string): string {
  return domArtFileUrl(artUrl, path);
}
