import { herringSpawn } from "./dartOutcomes.ts";
import type { MoverPlacement } from "./moverModel.ts";
import { crossLength } from "./movers.ts";
import { isDartPlacement } from "./moverSpots.ts";
import type { SlotPlacement } from "./slotFeasibility.ts";
import type { Geometry, PreparedSlotKind } from "./slotKindPreparation.ts";
import { blockingLength, quotaFootprint, rowSpacing } from "./spawning.ts";

export function slotPlacementsAt<Kind extends string>(
  geometry: Geometry<Kind>,
  anchor: {
    readonly distance: number;
    readonly lane: number;
    readonly row: number;
    readonly slot: number;
  },
  prepared: PreparedSlotKind<Kind>,
): SlotPlacement<Kind>[] {
  return translatedPlacementsAt(geometry, anchor, prepared);
}

export function translatedPlacementsAt<Kind extends string>(
  geometry: Geometry<Kind>,
  anchor: Parameters<typeof slotPlacementsAt<Kind>>[1],
  prepared: PreparedSlotKind<Kind>,
  eligible?: ReadonlySet<MoverPlacement>,
  placements: readonly MoverPlacement[] = prepared.placements,
): SlotPlacement<Kind>[] {
  const { draws, request } = prepared;
  const { distance, lane, row, slot } = anchor;
  const spacing = rowSpacing({ ...geometry, quotas: [] });
  const identity = { index: 0, memberIndex: 0, quotaIndex: slot };
  if (!prepared.columns.includes(lane)) {
    return [];
  }
  if (request.mover === undefined) {
    const until =
      distance +
      geometry.roadLength +
      (request.hitLength ?? quotaFootprint(request).rows * geometry.cellLength);
    return [
      {
        event: { distance, kind: request.kind, lane },
        herring: false,
        request,
        trace: {
          ...identity,
          entry: distance,
          hazard: request.hazard ?? request.blocksLane,
          kind: request.kind,
          lane,
          nativeUntil: until,
          row: Math.floor(distance / spacing),
          source: "events",
          until,
        },
      },
    ];
  }
  if (draws === undefined) {
    throw new Error("A compiled moving slot needs frozen draws");
  }
  const grid = { ...geometry, rowSpacing: spacing, window: blockingLength(geometry, 1) };
  const clearance =
    Math.max(0, geometry.roadLength - geometry.sightLength) +
    geometry.packLength +
    (request.mover.hitLength ?? geometry.cellLength);
  if (prepared.herring) {
    const event = herringSpawn(grid, request.mover, draws, request.kind, [distance]);
    if (event?.mover.motion !== "cross" || event.lane !== lane) {
      return [];
    }
    const nativeUntil =
      event.distance +
      crossLength(geometry.laneCount, request.mover.footprint.lanes) / event.mover.lanesPerPixel;
    return [
      {
        event,
        herring: true,
        request,
        trace: {
          ...identity,
          entry: event.distance,
          hazard: request.hazard ?? request.blocksLane,
          kind: request.kind,
          lane,
          nativeUntil,
          requestedDraws: draws,
          row: Math.floor(event.distance / spacing),
          source: "herrings",
          until: nativeUntil + clearance,
        },
      },
    ];
  }
  const translated = new Map<MoverPlacement, SlotPlacement<Kind>[]>();
  return placements
    .filter(
      (placement) => placement.lane === lane && (eligible === undefined || eligible.has(placement)),
    )
    .flatMap((placement): SlotPlacement<Kind>[] => {
      const previous = translated.get(placement);
      if (previous !== undefined) {
        return previous;
      }
      const screen = [distance + placement.screen[0], distance + placement.screen[1]] as const;
      if (screen[0] < 0 || screen[1] > geometry.zoneLength) {
        translated.set(placement, []);
        return [];
      }
      const event = {
        distance: distance + placement.appears,
        kind: request.kind,
        lane,
        mover: placement.path,
      };
      const entries: SlotPlacement<Kind>[] = [
        {
          event,
          herring: false,
          placement,
          request,
          trace: {
            ...identity,
            entry: event.distance,
            hazard: request.hazard ?? request.blocksLane,
            kind: request.kind,
            lane,
            nativeUntil: screen[1],
            placement: {
              block: {
                dart: isDartPlacement(placement),
                lanes: placement.lanes,
                row,
                rows: placement.rows,
              },
              ...(placement.body === undefined
                ? {}
                : {
                    body: {
                      ...placement.body,
                      from: distance + placement.body.from,
                      to: distance + placement.body.to,
                    },
                  }),
              cells: placement.cells.map((cell) => ({ lane: cell.lane, row: row + cell.row })),
              screen,
              selection: placement.selection ?? { draws, lift: 0 },
              stands: placement.stands.map((stand) => ({
                ...stand,
                distance: distance + stand.distance,
              })),
            },
            requestedDraws: draws,
            row: Math.floor(event.distance / spacing),
            source: "events",
            until: screen[1] + clearance,
          },
        },
      ];
      translated.set(placement, entries);
      return entries;
    });
}
