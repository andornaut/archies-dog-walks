import { itemAt } from "@andornaut/game-kit/runtime/arrays";
import { keysOf } from "@andornaut/game-kit/runtime/records";

import type { GameData } from "../data/index.ts";
import { slotCountTotal, type WalkItemKind } from "../runner/index.ts";
import { type Delivered, DELIVERY_GROUPS, sumDeliveries } from "./delivery.ts";
import { type MatrixRow, obstacleKinds } from "./rowSummary.ts";
import {
  combineRoadObstacleSummaries,
  DEFAULT_SPAWN_TARGET,
  sumSpawnEvents,
} from "./spawnReport.ts";

function dollars(cents: number): string {
  return `$${Math.round(cents / 100)}`;
}

function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

// A share to one decimal of a percent, or a dash when nothing was met.
function measured(share: number | null): string {
  return share === null ? "-" : `${(share * 100).toFixed(1)}%`;
}

// The columns that name a row's cell, left-aligned at the start of every table of rows.
const CELL_HEADERS = ["Policy", "Route", "Player", "Gear", "Pack", "Walker"] as const;

function cellNames(row: MatrixRow): string[] {
  return [row.policy, row.route, row.player, row.gear, row.pack, row.walker];
}

// A row's cells as text, in MATRIX_HEADERS order. Player is the skill preset; Hit, Bump and
// Lucky are measured.
export const MATRIX_HEADERS = [
  ...CELL_HEADERS,
  "Hit",
  "Bump",
  "Forced",
  "Lucky",
  "Tips",
  "Drops",
  "Grabs",
  "Mean",
  "p10",
  "p50",
  "p90",
  "Fired",
  "Fired%",
  "Zones",
  "Finished",
  "Cards",
  "Paid",
  "Badges",
] as const;

export function rowCells(row: MatrixRow): string[] {
  if (row.gameplayStatus === "unavailable") {
    return [
      ...cellNames(row),
      ...MATRIX_HEADERS.slice(CELL_HEADERS.length).map(() => "unavailable"),
    ];
  }
  return [
    ...cellNames(row),
    measured(row.hitShare),
    measured(row.bumpShare),
    measured(row.afterPullShare),
    measured(row.luckyShare),
    row.meanTips.toFixed(1),
    row.meanDrops.toFixed(2),
    row.meanGrabs.toFixed(2),
    dollars(row.meanEarnings),
    dollars(row.p10),
    dollars(row.p50),
    dollars(row.p90),
    row.meanFirings.toFixed(2),
    percent(row.firedShare),
    row.meanZones.toFixed(2),
    percent(row.finishedShare),
    row.meanCardsSeen.toFixed(1),
    row.moneyShare === null ? "-" : percent(row.moneyShare),
    row.meanBadges.toFixed(2),
  ];
}

// A fixed-width text table: the first leftAligned columns left-aligned, the rest right-aligned.
function textTable(
  leftAligned: number,
  headers: readonly string[],
  rows: readonly (readonly string[])[],
): string {
  const lines = [headers, ...rows];
  const widths = headers.map((_, column) =>
    Math.max(...lines.map((line) => itemAt(line, column).length)),
  );
  return lines
    .map((line) =>
      line
        .map((text, column) =>
          column < leftAligned
            ? text.padEnd(itemAt(widths, column))
            : text.padStart(itemAt(widths, column)),
        )
        .join("  ")
        .trimEnd(),
    )
    .join("\n");
}

export function formatTable(rows: readonly MatrixRow[]): string {
  return textTable(CELL_HEADERS.length, MATRIX_HEADERS, rows.map(rowCells));
}

// The measured hit rate of each obstacle kind, one column per kind, then of each mover.
export function formatKindTable(
  data: Pick<GameData, "encounters" | "minorObstacles">,
  rows: readonly MatrixRow[],
): string {
  const kinds = obstacleKinds(data);
  // Every kind any row met as a mover, after the kinds standing still.
  const movers = [...new Set(rows.flatMap((row) => keysOf(row.moverHitShares)))].sort();
  return textTable(
    CELL_HEADERS.length,
    [...CELL_HEADERS, ...kinds, ...movers.map((kind) => `moving ${kind}`)],
    rows.map((row) => [
      ...cellNames(row),
      ...kinds.map((kind) => measured(row.kindHitShares[kind] ?? null)),
      ...movers.map((mover) => measured(row.moverHitShares[mover] ?? null)),
    ]),
  );
}

// The share of cards the policy fell back on (a dash for a policy with no fallback), then what
// each debuff cost per walk: for each debuff, the landed bumps while it lasted and the dollars
// it took.
export function formatDebuffCostTable(
  data: Pick<GameData, "debuffs">,
  rows: readonly MatrixRow[],
): string {
  const debuffs = keysOf(data.debuffs);
  return textTable(
    CELL_HEADERS.length,
    [
      ...CELL_HEADERS,
      "Fallback",
      ...debuffs.flatMap((debuff) => [`${debuff} bumps`, `${debuff} lost`]),
    ],
    rows.map((row) => [
      ...cellNames(row),
      row.policyFallbackShare === null ? "-" : percent(row.policyFallbackShare),
      ...debuffs.flatMap((debuff) => {
        const cost = row.debuffCosts[debuff];
        return row.gameplayStatus === "unavailable"
          ? ["unavailable", "unavailable"]
          : [cost.meanBumpsWhile.toFixed(2), dollars(cost.meanCentsLost)];
      }),
    ]),
  );
}

const DELIVERY_HEADERS: Readonly<Record<(typeof DELIVERY_GROUPS)[number], string>> = {
  card: "Card",
  drops: "Drops",
  lucky: "Lucky",
  minorDart: "Dart",
  minorOther: "Hop/stalk",
  minorRider: "Rider",
  minorStatic: "Static",
  noCard: "No card",
  tips: "Tips",
  treats: "Treats",
};

// Placed and planned per zone plan, to two decimals, as "placed/planned".
function perPlan(plans: number, count: Delivered): string {
  return `${(count.placed / plans).toFixed(2)}/${(count.planned / plans).toFixed(2)}`;
}

// What the zone plans delivered, summed over every row by walk position and zone: one line per
// zone at a walk position, and for each group the mean placed and planned per plan.
export function formatDeliveryTable(rows: readonly MatrixRow[]): string {
  const sums = sumDeliveries(rows.flatMap((row) => row.delivery));
  return textTable(
    2,
    [
      "Pos",
      "Zone",
      "Plans",
      "Original total",
      "Delivered total",
      "Omitted",
      "Complete plans",
      "Partial plans",
      ...DELIVERY_GROUPS.map((group) => DELIVERY_HEADERS[group]),
    ],
    sums.map((sum) => [
      String(sum.position),
      sum.zone,
      String(sum.plans),
      ...(["configured", "delivered", "omitted", "completePlans", "partialPlans"] as const).map(
        (field) => (sum.runtime === undefined ? "unavailable" : String(sum.runtime[field])),
      ),
      ...DELIVERY_GROUPS.map((group) => perPlan(sum.plans, sum.groups[group])),
    ]),
  );
}

// The delivery table by kind: one line per kind planned or placed in a zone at a walk position,
// moving or not, with the mean placed and planned per plan.
export function formatDeliveryKindTable(rows: readonly MatrixRow[]): string {
  const sums = sumDeliveries(rows.flatMap((row) => row.delivery));
  return textTable(
    3,
    ["Pos", "Zone", "Kind", "Plans", "Placed/planned"],
    sums.flatMap((sum) =>
      (Object.entries(sum.kinds) as [WalkItemKind, Delivered][])
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([kind, count]) => [
          String(sum.position),
          sum.zone,
          kind,
          String(sum.plans),
          perPlan(sum.plans, count),
        ]),
    ),
  );
}

export function formatSpawnEventTable(rows: readonly MatrixRow[], byKind = false): string {
  const sums = sumSpawnEvents(
    rows.flatMap((row) => row.spawnRuns.flatMap((run) => run.zones)),
    byKind,
    rows.flatMap((row) =>
      row.spawnRuns.filter((run) => run.failure === null).flatMap((run) => run.zones),
    ),
  );
  const obstacles = new Map(
    combineRoadObstacleSummaries(rows.flatMap((row) => row.roadObstacleSummary ?? [])).map(
      (sum) => [`${sum.position}:${sum.zone}`, sum],
    ),
  );
  return textTable(
    3,
    [
      "Pos",
      "Zone",
      "Kind",
      "Exposures",
      "Variation exposures",
      "Frozen configured",
      "Planned",
      "Requested",
      "Admitted",
      "Valid",
      "Generated",
      "Scene herrings",
      "Encountered",
      "Touched",
      "Passed",
      "Departed",
      "Requested/exposure mean[min,max]",
      "Valid/configured",
      `${DEFAULT_SPAWN_TARGET * 100}% delivery floor`,
      "100% configured target",
      "Obstacle requested",
      "Obstacle valid",
      "Obstacle valid/configured",
    ],
    sums.map((sum) => {
      const road = obstacles.get(`${sum.position}:${sum.zone}`);
      return [
        String(sum.position),
        sum.zone,
        sum.kind,
        String(sum.exposures),
        String(sum.variationExposures),
        sum.configured === null ? "unavailable" : String(sum.configured),
        String(sum.planned),
        String(sum.requested),
        String(sum.admitted),
        sum.valid === null ? "unverified" : String(sum.valid),
        String(sum.generated),
        String(sum.herrings),
        String(sum.encountered),
        String(sum.touched),
        String(sum.passed),
        String(sum.departed),
        sum.perExposure.requested === null
          ? "unavailable"
          : `${sum.perExposure.requested.mean.toFixed(2)}` +
            `[${sum.perExposure.requested.min},${sum.perExposure.requested.max}]`,
        sum.validConfiguredRate === null
          ? "unverified"
          : `${(sum.validConfiguredRate * 100).toFixed(1)}%`,
        sum.goal,
        sum.configuredTargetGoal,
        road === undefined ? "unavailable" : String(road.requested),
        road?.valid == null ? "unverified" : String(road.valid),
        road?.validConfiguredRate == null
          ? "unverified"
          : `${(road.validConfiguredRate * 100).toFixed(1)}%`,
      ];
    }),
  );
}

export function formatSpawnFailures(rows: readonly MatrixRow[]): string {
  const failures = rows.flatMap((row) => row.spawnRuns.filter((run) => run.failure !== null));
  return textTable(
    3,
    ["Seed", "Zone index", "Kind", "Frozen configured", "Admitted", "Valid", "Snapshot"],
    failures.map((run) => {
      const failure = run.failure!;
      return [
        String(run.seed),
        String(run.zoneIndex),
        "all",
        String(
          slotCountTotal(failure.input.config.active) +
            failure.input.auxiliary.reduce((count, quota) => count + quota.count, 0),
        ),
        "unavailable",
        "unverified",
        run.snapshotPath ?? "embedded in spawnRuns",
      ];
    }),
  );
}
