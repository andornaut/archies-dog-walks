import { gameData } from "../data/index.ts";
import type { GameData } from "../data/types.ts";
import { jsonText } from "./files.ts";
import { gameDataExport } from "./gameDataExport.ts";
import { layoutExport } from "./layoutExport.ts";

// Where npm run export:data writes, relative to the repository root.
export const DATA_EXPORT_DIR = "shared/export";

// Each export file's path from the repository root, and its text.
export function dataExportFiles(data: GameData): Map<string, string> {
  return new Map([
    [`${DATA_EXPORT_DIR}/game-data.json`, jsonText(gameDataExport(data))],
    [`${DATA_EXPORT_DIR}/layout.json`, jsonText(layoutExport(data))],
  ]);
}

// The export of the live game data, for a caller that loads this module fresh.
export function currentDataExportFiles(): Map<string, string> {
  return dataExportFiles(gameData);
}
