// npm run export:data [-- --check]
// Writes shared/export/game-data.json and layout.json from the game's modules, for art's tools,
// and public/tokens.css, the site's design tokens.
// --check writes nothing and fails if the committed files differ from what the code exports.
import { gameData } from "../data/index.ts";
import { DATA_EXPORT_DIR, dataExportFiles } from "./dataExport.ts";
import { writeOrCheck } from "./files.ts";
import { SITE_TOKENS_PATH } from "./siteTokens.ts";

process.exitCode = await writeOrCheck(
  "npm run export:data",
  `${DATA_EXPORT_DIR} and ${SITE_TOKENS_PATH}`,
  dataExportFiles(gameData),
);
