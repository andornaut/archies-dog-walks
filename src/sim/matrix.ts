import { DOGS } from "../data/dogs.ts";
import type { GearId, WalkerId } from "../data/ids.ts";
import { DEFAULT_WALKER } from "../data/walkers.ts";
import type { PackDogs } from "../state/index.ts";
import { DEFAULT_ROUTE_POLICY, POLICY_IDS, type PolicyId, type RoutePolicyId } from "./policies.ts";
import { type MatrixRow, summarizeCell } from "./rowSummary.ts";
import type { BotSight } from "./sight.ts";
import { type RunResult, type SimData, type SimPlayer, simulateRun } from "./simulate.ts";
import { SKILL_PRESET_IDS, SKILL_PRESETS, type SkillPresetId } from "./skills.ts";

export interface NamedPack {
  readonly dogs: PackDogs;
  readonly name: string;
}

// A matrix's player: a steering bot of a skill preset.
export interface MatrixPlayer {
  readonly kind: "skill";
  readonly preset: SkillPresetId;
}

// Every combination of policy, route policy, player, gear, pack and walker is one cell. A null
// gear is a walk with none equipped. sight is how every cell's bot reads movers.
export interface Matrix {
  readonly gears: readonly (GearId | null)[];
  readonly packs: readonly NamedPack[];
  readonly players: readonly MatrixPlayer[];
  readonly policies: readonly PolicyId[];
  readonly routes: readonly RoutePolicyId[];
  readonly sight: BotSight;
  readonly walkers: readonly WalkerId[];
}

export interface MatrixCell {
  readonly gear: GearId | null;
  readonly pack: NamedPack;
  readonly player: MatrixPlayer;
  readonly policy: PolicyId;
  readonly route: RoutePolicyId;
  readonly sight: BotSight;
  readonly walker: WalkerId;
}

// A pack named by its dogs' names in the data. The name is for display only: the pack's seeds
// are keyed on its dog ids, so renaming a dog changes no result.
function namedByDogs(dogs: PackDogs): NamedPack {
  return { dogs, name: dogs.map((dog) => DOGS[dog].name).join(" + ") };
}

const PACKS: readonly NamedPack[] = [
  namedByDogs(["ginger"]),
  namedByDogs(["lady"]),
  namedByDogs(["kilo"]),
  namedByDogs(["penny"]),
  namedByDogs(["kilo", "lady"]),
  namedByDogs(["reggie", "pepe"]),
  namedByDogs(["ginger", "lady", "kilo"]),
  { dogs: ["buddy", "archie", "sequoia"], name: "Risky trio" },
];

const SKILL_PLAYERS: readonly MatrixPlayer[] = SKILL_PRESET_IDS.map((preset) => ({
  kind: "skill",
  preset,
}));

export const DEFAULT_MATRIX: Matrix = {
  gears: [null],
  packs: PACKS,
  players: SKILL_PLAYERS,
  policies: POLICY_IDS,
  routes: [DEFAULT_ROUTE_POLICY],
  sight: "sight",
  walkers: [DEFAULT_WALKER],
};

export function matrixCells(matrix: Matrix): MatrixCell[] {
  return matrix.policies.flatMap((policy) =>
    matrix.routes.flatMap((route) =>
      matrix.players.flatMap((player) =>
        matrix.gears.flatMap((gear) =>
          matrix.packs.flatMap((pack) =>
            matrix.walkers.map((walker) => ({
              gear,
              pack,
              player,
              policy,
              route,
              sight: matrix.sight,
              walker,
            })),
          ),
        ),
      ),
    ),
  );
}

// FNV-1a over the text, as an unsigned 32-bit seed.
function hashSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  }
  return hash >>> 0;
}

function simPlayer(sight: BotSight, player: MatrixPlayer): SimPlayer {
  return { kind: "skill", sight, skill: SKILL_PRESETS[player.preset] };
}

// Run number run of a cell. It is seeded by the seed, the pack's dog ids in pack order and the
// run number alone, so every policy, route policy, player, gear and walker meets the same first
// zone plan and their rows differ by the choices and the play, not by the draw.
function simulateCellRun(data: SimData, seed: number, cell: MatrixCell, run: number): RunResult {
  return simulateRun(data, hashSeed(`${seed}:${cell.pack.dogs.join(",")}:${run}`), {
    gear: cell.gear,
    pack: cell.pack.dogs,
    player: simPlayer(cell.sight, cell.player),
    policy: cell.policy,
    route: cell.route,
    walker: cell.walker,
  });
}

export function simulateCell(
  data: SimData,
  seed: number,
  runsPerCell: number,
  cell: MatrixCell,
): MatrixRow {
  const results = Array.from({ length: runsPerCell }, (_, run) =>
    simulateCellRun(data, seed, cell, run),
  );
  return summarizeCell(
    data,
    cell,
    results,
    results.map((_, run) => hashSeed(`${seed}:${cell.pack.dogs.join(",")}:${run}`)),
  );
}

// One row per cell, in matrix order. The same seed always gives the same rows.
export function simulateMatrix(
  data: SimData,
  seed: number,
  runsPerCell: number,
  matrix: Matrix,
): MatrixRow[] {
  return matrixCells(matrix).map((cell) => simulateCell(data, seed, runsPerCell, cell));
}
