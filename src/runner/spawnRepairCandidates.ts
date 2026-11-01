import { itemAt } from "@andornaut/game-kit/arrays";

import {
  DART_LIFTS,
  herringSpawn,
  moverPlacements,
  moverRetries,
  sameMoverMotion,
} from "./moverPlanning";
import { crossLength } from "./movers";
import { blockingLength, quotaFootprint, rowSpacing, type SpawnPlan, zoneRows } from "./spawning";
import type { RepairEntry as Entry } from "./spawnRepairFeasibility";
import type { SpawnConstruction } from "./spawnSearch";
import { nthStretch, rowsWithin, WHOLE_ZONE } from "./stretches";

interface CandidateProgress {
  exhausted(): boolean;
  generated(): void;
}

export function createRepairCandidates<Kind extends string>(
  plan: SpawnPlan<Kind>,
  progress: CandidateProgress,
  construction: SpawnConstruction,
) {
  const spacing = rowSpacing(plan),
    rows = zoneRows(plan, spacing);
  const geometry = { ...plan, rowSpacing: spacing, window: blockingLength(plan, 1) };
  function* placements(
    quotaIndex: number,
    memberIndex: number,
    previous?: Entry<Kind>,
  ): Generator<Entry<Kind>> {
    if (progress.exhausted()) {
      return;
    }
    const quota = itemAt(plan.quotas, quotaIndex),
      spec = quota.mover;
    const [first, end] = rowsWithin(rows.length, quota.within ?? WHOLE_ZONE);
    const original = construction.drawn[quotaIndex]?.[memberIndex];
    const [from, to] = nthStretch(quota.count, memberIndex, [first, end]);
    const target =
      previous?.trace.placement?.block.row ??
      (previous === undefined
        ? Math.floor(from + (original?.draws.start ?? 0.5) * (to - from))
        : rows.indexOf(previous.event.distance));
    const orderedRows = Array.from({ length: end - first }, (_, i) => first + i).sort(
      (a, b) => Math.abs(a - target) - Math.abs(b - target) || a - b,
    );
    if (spec === undefined) {
      const footprint = quotaFootprint(quota);
      for (const row of orderedRows) {
        for (let lane = 0; lane + footprint.lanes <= plan.laneCount; lane++) {
          const distance = itemAt(rows, row);
          const until =
            distance + plan.roadLength + (quota.hitLength ?? footprint.rows * plan.cellLength);
          if (progress.exhausted()) {
            return;
          }
          progress.generated();
          yield {
            event: { distance, kind: quota.kind, lane },
            herring: false,
            trace: {
              entry: distance,
              hazard: quota.hazard ?? quota.blocksLane,
              index: 0,
              kind: quota.kind,
              lane,
              memberIndex,
              nativeUntil: until,
              quotaIndex,
              row: Math.floor(distance / spacing),
              source: "events",
              until,
            },
          };
        }
      }
      return;
    }
    if (original === undefined) {
      throw new Error("Missing frozen repair draws");
    }
    if (original.herring) {
      for (const row of orderedRows) {
        const event = herringSpawn(geometry, spec, original.draws, quota.kind, [itemAt(rows, row)]);
        if (event?.mover.motion !== "cross") {
          continue;
        }
        const until =
          event.distance +
          crossLength(plan.laneCount, spec.footprint.lanes) / event.mover.lanesPerPixel;
        if (progress.exhausted()) {
          return;
        }
        progress.generated();
        yield {
          event,
          herring: true,
          trace: {
            entry: event.distance,
            hazard: quota.hazard ?? quota.blocksLane,
            index: 0,
            kind: quota.kind,
            lane: event.lane,
            memberIndex,
            nativeUntil: until,
            quotaIndex,
            requestedDraws: original.draws,
            row: Math.floor(event.distance / spacing),
            source: "herrings",
            until,
          },
        };
      }
      return;
    }
    const prior = previous?.trace.placement?.selection;
    const selections =
      prior === undefined
        ? [original.draws, ...moverRetries(spec, original.draws)].flatMap((draws) =>
            (spec.motion.kind === "cross" ? [0, ...DART_LIFTS] : [0]).map((lift) => ({
              draws,
              lift,
            })),
          )
        : [prior];
    let choices = selections.flatMap((selection) =>
      moverPlacements(geometry, spec, selection.draws, selection.lift)
        .filter(
          (p) =>
            previous?.event.mover === undefined || sameMoverMotion(previous.event.mover, p.path),
        )
        .map((p) => ({ placement: p, selection })),
    );
    const unique = new Map<string, (typeof choices)[number]>();
    for (const choice of choices) {
      const key = JSON.stringify(choice.placement);
      if (!unique.has(key)) {
        unique.set(key, choice);
      }
    }
    choices = [...unique.values()];
    if (previous === undefined) {
      const widest = Math.max(...choices.map(({ placement }) => placement.rank ?? 0));
      choices = choices.filter(({ placement }) => (placement.rank ?? 0) === widest);
    }
    function* visits() {
      const seen = new Set<number>();
      for (let cursor = 0; cursor < orderedRows.length * choices.length; cursor++) {
        const pairs = [[Math.floor(cursor / choices.length), cursor % choices.length]];
        if (previous === undefined) {
          pairs.push([cursor % orderedRows.length, Math.floor(cursor / orderedRows.length)]);
        }
        for (const [rowIndex, choiceIndex] of pairs) {
          const key = rowIndex! * choices.length + choiceIndex!;
          if (seen.has(key)) {
            continue;
          }
          seen.add(key);
          yield { row: itemAt(orderedRows, rowIndex!), ...itemAt(choices, choiceIndex!) };
        }
      }
    }
    for (const { placement: p, row, selection } of visits()) {
      const distance = itemAt(rows, row),
        screen = [distance + p.screen[0], distance + p.screen[1]] as const;
      if (screen[0] < 0 || screen[1] > plan.zoneLength) {
        continue;
      }
      const event = {
        distance: distance + p.appears,
        kind: quota.kind,
        lane: p.lane,
        mover: p.path,
      };
      const clearance =
        Math.max(0, plan.roadLength - plan.sightLength) +
        plan.packLength +
        (spec.hitLength ?? plan.cellLength);
      if (progress.exhausted()) {
        return;
      }
      progress.generated();
      yield {
        event,
        herring: false,
        placement: p,
        trace: {
          entry: event.distance,
          hazard: quota.hazard ?? quota.blocksLane,
          index: 0,
          kind: quota.kind,
          lane: p.lane,
          memberIndex,
          nativeUntil: screen[1],
          placement: {
            block: { dart: p.path.motion === "cross", lanes: p.lanes, row, rows: p.rows },
            ...(p.body === undefined
              ? {}
              : { body: { ...p.body, from: distance + p.body.from, to: distance + p.body.to } }),
            cells: p.cells.map((c) => ({ lane: c.lane, row: row + c.row })),
            screen,
            selection,
            stands: p.stands.map((s) => ({ ...s, distance: distance + s.distance })),
          },
          quotaIndex,
          requestedDraws: original.draws,
          row: Math.floor(event.distance / spacing),
          source: "events",
          until: screen[1] + clearance,
        },
      };
    }
  }
  return { geometry, placements };
}
