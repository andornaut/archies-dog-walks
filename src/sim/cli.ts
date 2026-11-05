// npm run simulate -- --help
// Runs a matrix, prints its tables and, with --out, writes the rows as JSON.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";

import { itemAt } from "@andornaut/game-kit/arrays";
import { keysOf } from "@andornaut/game-kit/records";

import { gameData } from "../data/index.ts";
import type { GearId } from "../data/types.ts";
import { USAGE_EXIT_CODE, UsageError } from "../tools/usage.ts";
import { DEFAULT_ROUTE_POLICY, MIXED_PAY_SHARE, POLICY_IDS, ROUTE_POLICY_IDS } from "./policies.ts";
import {
  DEFAULT_MATRIX,
  DEFAULT_SPAWN_TARGET,
  formatDebuffCostTable,
  formatDeliveryKindTable,
  formatDeliveryTable,
  formatKindTable,
  formatSpawnEventTable,
  formatSpawnFailures,
  formatTable,
  type Matrix,
  matrixCells,
  type MatrixPlayer,
  type MatrixRow,
  parseSpawnTarget,
  simulateCell,
  spawnValidationFailures,
} from "./report.ts";
import { BOT_SIGHTS } from "./sight.ts";
import { SKILL_PRESET_IDS, SKILL_PRESETS } from "./skills.ts";

const DEFAULT_RUNS = 1000;
const WALKER_IDS = keysOf(gameData.walkers);
const DEFAULT_SEED = 1;

const presetLines = SKILL_PRESET_IDS.map((id) => {
  const skill = SKILL_PRESETS[id];
  return (
    `  ${id.padEnd(8)} reaction ${skill.reactionSeconds}s, drift reaction ` +
    `${skill.driftReactionSeconds}s, look-ahead ${skill.lookAheadSeconds}s, ` +
    `errors ${skill.errorRate * 100}%, cooldown ${skill.laneChangeCooldown}s`
  );
});

const USAGE = [
  "npm run simulate -- [--skill preset,...] [--policy id,...]",
  "                    [--route id,...] [--gear id,...] [--walker id,...] [--runs N] [--seed N]",
  "                    [--bot foresight|sight] [--delivery groups|kinds] [--spawn-target fraction] [--out file]",
  "",
  "Plays whole runs on the real rules and data, one row per policy, route, player, gear, pack",
  "and walker.",
  "",
  "  --skill   steering bots of these skill presets play the real walk loop, with pulls, chases",
  "            and movers, and their hit rates are measured (default: every preset)",
  `  --policy  card choice policies (default: ${POLICY_IDS.join(",")})`,
  `  --route   the path taken at each fork, of ${ROUTE_POLICY_IDS.join(", ")}: straight is the`,
  "            middle path, left the easiest and right the hardest",
  `            (default: ${DEFAULT_ROUTE_POLICY})`,
  `  --gear    the gear equipped, of none, ${Object.keys(gameData.shopGear).join(", ")}`,
  "            (default: none)",
  `  --walker  walkers, of ${WALKER_IDS.join(", ")} (default: ${gameData.defaultWalker})`,
  `  --runs    runs per row (default: ${DEFAULT_RUNS})`,
  `  --seed    the seed; the same seed gives the same rows (default: ${DEFAULT_SEED})`,
  "  --bot     how the bots read movers: sight reads only what a player sees, a mover's cue and",
  "            its moves as they start; foresight reads every mover's whole planned path, for",
  `            checking the road stays passable (default: ${DEFAULT_MATRIX.sight})`,
  "  --delivery",
  "            the delivery table: groups gives a column per group, kinds also a line per kind",
  "            (default: groups)",
  "  --spawn-target fraction of frozen configured events independently valid in EVERY zone",
  `                 (0.8 to 1, default: ${DEFAULT_SPAWN_TARGET}; use 1 for the 100% configured target)`,
  "                 the runtime delivery policy also applies when a lower target is requested",
  "  --out     also write the matrix and rows as JSON to this file",
  "",
  "Card policies (a safe option leaves no owner whose meter falls at 1 heart or less):",
  "  heartsUnlessLow  the free option, unless it is not safe: then the cheapest safe money option",
  "  alwaysHearts     always the free option",
  "  alwaysPay        the cheapest money option whenever one is affordable",
  `  mixed            as heartsUnlessLow, but pays ${MIXED_PAY_SHARE * 100}% of the time when both are safe`,
  "  debuffs          a safe option that gives a debuff whenever one is offered, else as mixed",
  "  noDebuffs        no option that gives a debuff while a safe hearts or money option is",
  "                   offered: as mixed among those, else as mixed among them all",
  "The free option keeps the most money, then the most hearts, so it is a debuff option over",
  "one that costs hearts.",
  "",
  "Skill presets:",
  ...presetLines,
  "",
  "Hit, Bump and Lucky are the measured shares of obstacles, minor obstacles (both moving or",
  "not) and lucky encounters that reached the pack and were hit or collected. Tips is tips",
  "collected per run, Drops the gear drops that reached the pack per run and Grabs those",
  "grabbed, Zones zones finished per run. A second table gives the hit rate of each",
  "obstacle kind that stands still, then of each mover.",
  "",
  "The debuff table gives Fallback, the share of cards the debuffs or noDebuffs policy fell back",
  "on and played as mixed (a dash for the other policies), then, per walk, each debuff's landed",
  "bumps while it lasted (bumps) and the dollars it took (lost): its share of each tip's pay,",
  "such as Stinky's, and the cash bumps cost while it made them cost cash, such as Spotlight's.",
  "",
  "The delivery table compares each zone's plan with the road it placed, by walk position (Pos)",
  "and zone, summed over every row: Plans is the zones planned, and each group column the mean",
  "placed/planned per plan. Planned is what the tuning counts and weights asked for; the",
  "planner skips a spawn it has no room for. Tips, Treats, Lucky and Drops are pickups, lucky",
  "finds and gear drops; Static, Dart, Rider and Hop/stalk are minor obstacles standing still, darting across,",
  "riding in a lane, and hopping or stalking; Card and No card are obstacles that open a card",
  "and those that do not. A mover planned that stood still counts as placed standing.",
].join("\n");

const DELIVERY_VIEWS = ["groups", "kinds"] as const;

interface Options {
  readonly delivery: (typeof DELIVERY_VIEWS)[number];
  readonly help: boolean;
  readonly matrix: Matrix;
  readonly out: string | undefined;
  readonly runs: number;
  readonly seed: number;
  readonly spawnTarget: number;
}

// The cells one worker simulates, by index into matrixCells(matrix).
interface Job {
  readonly cells: readonly number[];
  readonly matrix: Matrix;
  readonly runs: number;
  readonly seed: number;
}

function parseWhole(flag: string, min: number, text: string): number {
  const value = Number(text);
  if (text === "" || !Number.isInteger(value) || value < min) {
    throw new UsageError(`${flag} takes a whole number from ${min}, not ${text}`);
  }
  return value;
}

function parseId<Id extends string>(flag: string, ids: readonly Id[], text: string): Id {
  const found = ids.find((candidate) => candidate === text);
  if (found === undefined) {
    throw new UsageError(`${flag} takes ${ids.join(", ")}, not ${text}`);
  }
  return found;
}

function parseIds<Id extends string>(flag: string, ids: readonly Id[], text: string): Id[] {
  return text.split(",").map((id) => parseId(flag, ids, id));
}

function parseGears(text: string): (GearId | null)[] {
  const ids = keysOf(gameData.shopGear);
  return text.split(",").map((id) => {
    const gear = id === "none" ? null : ids.find((candidate) => candidate === id);
    if (gear === undefined) {
      throw new UsageError(`--gear takes none, ${ids.join(", ")}, not ${id}`);
    }
    return gear;
  });
}

function parseArgs(args: readonly string[]): Options {
  let delivery: Options["delivery"] = "groups";
  let matrix = DEFAULT_MATRIX;
  let out: string | undefined;
  let runs = DEFAULT_RUNS;
  let seed = DEFAULT_SEED;
  let spawnTarget = DEFAULT_SPAWN_TARGET;
  let skills: MatrixPlayer[] = [];
  if (args.includes("--help") || args.includes("-h")) {
    return { delivery, help: true, matrix, out, runs, seed, spawnTarget };
  }
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    if (value === undefined) {
      throw new UsageError(`${flag} needs a value`);
    }
    switch (flag) {
      case "--bot":
        matrix = { ...matrix, sight: parseId(flag, BOT_SIGHTS, value) };
        break;
      case "--delivery":
        delivery = parseId(flag, DELIVERY_VIEWS, value);
        break;
      case "--gear":
        matrix = { ...matrix, gears: parseGears(value) };
        break;
      case "--skill":
        skills = parseIds(flag, SKILL_PRESET_IDS, value).map((preset): MatrixPlayer => ({
          kind: "skill",
          preset,
        }));
        break;
      case "--out":
        out = value;
        break;
      case "--policy":
        matrix = { ...matrix, policies: parseIds(flag, POLICY_IDS, value) };
        break;
      case "--route":
        matrix = { ...matrix, routes: parseIds(flag, ROUTE_POLICY_IDS, value) };
        break;
      case "--walker":
        matrix = { ...matrix, walkers: parseIds(flag, WALKER_IDS, value) };
        break;
      case "--runs":
        runs = parseWhole(flag, 1, value);
        break;
      case "--spawn-target":
        spawnTarget = parseSpawnTarget(value);
        break;
      case "--seed":
        seed = parseWhole(flag, 0, value);
        break;
      default:
        throw new UsageError(`Unknown option ${flag}\n\n${USAGE}`);
    }
  }
  if (skills.length > 0) {
    matrix = { ...matrix, players: skills };
  }
  return { delivery, help: false, matrix, out, runs, seed, spawnTarget };
}

function runJob({ cells, matrix, runs, seed }: Job): MatrixRow[] {
  const all = matrixCells(matrix);
  return cells.map((index) => simulateCell(gameData, seed, runs, itemAt(all, index)));
}

function runInWorker(job: Job): Promise<MatrixRow[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), { workerData: job });
    worker.once("message", (rows: unknown) => resolve(rows as MatrixRow[]));
    worker.once("error", reject);
    // A worker that dies without an error, such as one killed, sends nothing either.
    worker.once("exit", (code) =>
      reject(new Error(`A simulation worker exited with code ${code}`)),
    );
  });
}

// Cells are dealt out in turn to one worker per CPU. Each cell's runs are seeded by the
// cell alone, so the rows are the same however the cells are dealt.
async function simulateInWorkers(options: Options): Promise<MatrixRow[]> {
  const count = matrixCells(options.matrix).length;
  const workers = Math.min(count, availableParallelism(), 4);
  const jobs = Array.from({ length: workers }, (_, worker) => ({
    cells: Array.from({ length: count }, (_, cell) => cell).filter(
      (cell) => cell % workers === worker,
    ),
    matrix: options.matrix,
    runs: options.runs,
    seed: options.seed,
  }));
  const results = await Promise.all(jobs.map(runInWorker));
  return Array.from({ length: count }, (_, cell) =>
    itemAt(itemAt(results, cell % workers), Math.floor(cell / workers)),
  );
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${USAGE}\n`);
    return;
  }
  const started = performance.now();
  let rows = await simulateInWorkers(options);
  const failed = rows.some((row) => row.planningFailedRuns > 0);
  if (failed) {
    const directory =
      options.out === undefined
        ? mkdtempSync(join(tmpdir(), "dog-sim-failures-"))
        : `${resolve(options.out)}.failures`;
    mkdirSync(directory, { recursive: true });
    rows = rows.map((row, cell) => ({
      ...row,
      spawnRuns: row.spawnRuns.map((run, index) => {
        if (run.failure === null) {
          return run;
        }
        const snapshotPath = join(
          directory,
          `cell-${cell}-run-${index}-seed-${run.seed}-zone-${run.zoneIndex}.json`,
        );
        writeFileSync(
          snapshotPath,
          `${JSON.stringify(run.failure.kind === "slots" ? run.failure.input : run.failure.snapshot, null, 2)}\n`,
        );
        writeFileSync(`${snapshotPath}.metadata.json`, `${JSON.stringify(run, null, 2)}\n`);
        process.stderr.write(
          `Planning failure: seed ${run.seed}, zone ${run.zoneIndex}, snapshot ${snapshotPath}: ` +
            `${run.failure.message}\n`,
        );
        return { ...run, snapshotPath };
      }),
    }));
    const partialReport = {
      matrix: options.matrix,
      rows,
      seed: options.seed,
      spawnTarget: options.spawnTarget,
    };
    writeFileSync(
      join(directory, "partial-report.json"),
      `${JSON.stringify(partialReport, null, 2)}\n`,
    );
  }
  const seconds = (performance.now() - started) / 1000;
  const { matrix, out, runs, seed } = options;
  process.stdout.write(`${formatTable(rows)}\n\nHit rate by obstacle kind\n`);
  process.stdout.write(`${formatKindTable(gameData, rows)}\n\nDebuff costs per walk\n`);
  process.stdout.write(`${formatDebuffCostTable(gameData, rows)}\n\nDelivery by zone\n`);
  process.stdout.write(`${formatDeliveryTable(rows)}\n`);
  process.stdout.write(`\nSpawn events by zone\n${formatSpawnEventTable(rows)}\n`);
  process.stdout.write(
    "Generated means runner dispatches; encountered means native gameplay outcomes. " +
      "Frozen configured counts require the independent producer audit; " +
      "incomplete movement coverage stays unverified. " +
      "Theoretical per-kind weight variation: not measured. Scene-only herrings are not measured by runner dispatch.\n",
  );
  process.stdout.write(
    `Requested executions: ${rows.reduce((n, row) => n + row.requestedRuns, 0)}; ` +
      `completed executions: ${rows.reduce((n, row) => n + row.runs, 0)}; ` +
      `planning failures: ${rows.reduce((n, row) => n + row.planningFailedRuns, 0)}. ` +
      "Gameplay means exclude planning failures.\n",
  );
  if (failed) {
    process.stdout.write(
      `\nFailed plans (partial results retained)\n${formatSpawnFailures(rows, options.delivery === "kinds")}\n`,
    );
  }
  if (options.delivery === "kinds") {
    process.stdout.write(`\nDelivery by kind\n${formatDeliveryKindTable(rows)}\n`);
    process.stdout.write(`\nSpawn events by kind\n${formatSpawnEventTable(rows, true)}\n`);
  }
  process.stdout.write(
    `${rows.length} cells x ${runs} runs, seed ${seed}, bot ${matrix.sight}, in ${seconds.toFixed(1)}s\n`,
  );
  if (out !== undefined) {
    const json = { matrix, rows, runsPerCell: runs, seed, spawnTarget: options.spawnTarget };
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(out, `${JSON.stringify(json, null, 2)}\n`);
    process.stdout.write(`Wrote ${out}\n`);
  }
  const validationFailures = spawnValidationFailures(options.spawnTarget, rows);
  if (validationFailures.length > 0) {
    process.stderr.write(
      `Spawn validation failed (target ${options.spawnTarget * 100}% per zone):\n${validationFailures.join("\n")}\n`,
    );
  }
  if (failed || validationFailures.length > 0) {
    process.exitCode = 1;
  }
}

if (isMainThread) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = error instanceof UsageError ? USAGE_EXIT_CODE : 1;
  });
} else {
  parentPort?.postMessage(runJob(workerData as Job));
}
