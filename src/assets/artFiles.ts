import artFiles from "virtual:art-files";

import { artFileUrl } from "./artUrl.ts";

// The URL of an art file by its path under /art/: in a build, its content-hashed copy, so the
// code loads its own build's art whatever the service worker or the browser has cached. The
// canvas loader and the HTML interface's stylesheet both read it.
export function artUrl(path: string): string {
  return artFileUrl(import.meta.env.BASE_URL, artFiles, path);
}
