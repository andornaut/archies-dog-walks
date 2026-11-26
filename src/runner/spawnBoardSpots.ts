import type { Spot } from "./moverSpots.ts";
import type { SpawnPlacement } from "./spawnBoard.ts";

export const placementIdentity = (entry: SpawnPlacement<string>) =>
  `${entry.trace.quotaIndex}:${entry.trace.memberIndex}`;

export function spotForPlacement<Kind extends string>(
  rows: readonly number[],
  entry: SpawnPlacement<Kind>,
  hydrate: boolean,
): Spot | undefined {
  const proof = entry.trace.placement,
    row = proof?.block.row;
  if (
    proof === undefined ||
    row === undefined ||
    rows[row] === undefined ||
    entry.event.mover === undefined
  ) {
    return undefined;
  }
  const distance = rows[row]!;
  const placement =
    entry.placement ??
    (hydrate
      ? {
          appears: entry.event.distance - distance,
          cells: proof.cells.map((cell) => ({ ...cell, row: cell.row - row })),
          lane: entry.event.lane,
          lanes: proof.block.lanes,
          path: entry.event.mover,
          rows: proof.block.rows,
          ...(proof.body === undefined
            ? {}
            : {
                body: {
                  ...proof.body,
                  from: proof.body.from - distance,
                  to: proof.body.to - distance,
                },
              }),
          screen: [proof.screen[0] - distance, proof.screen[1] - distance] as const,
          stands: proof.stands.map((stand) => ({
            ...stand,
            distance: stand.distance - distance,
          })),
          ...(proof.selection === undefined ? {} : { selection: proof.selection }),
        }
      : undefined);
  return placement === undefined ? undefined : { distance, placement, row };
}
