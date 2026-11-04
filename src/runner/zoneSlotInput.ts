import type { GameData } from "../data/types";
import type { RunState } from "../state/runState";
import type { ProfiledMovement } from "./movementAssignments";
import { moverSpec } from "./moverSpecs";
import type { SlotConfiguration, SlotKind } from "./slotConfig";
import {
  planSlotCapacity,
  planSlotSpawns,
  type SlotCapacityResult,
  type SlotPlanningContext,
  SlotPlanningError,
  type SlotPlanningResult,
} from "./slotPlanner";
import type { SpawnPlan, SpawnQuota } from "./spawning";

export interface ZoneSlotKind<Kind extends string> extends Omit<SlotKind<Kind>, "compile"> {
  readonly movement: ProfiledMovement | null;
  readonly movingHitLength?: number;
  readonly spec: Omit<SpawnQuota<Kind>, "count" | "kind" | "mover">;
}
export interface ZoneSlotInput<Kind extends string> {
  readonly actualRun: RunState;
  readonly auxiliary: readonly SpawnQuota<Kind>[];
  readonly catalogue: readonly ZoneSlotKind<Kind>[];
  readonly config: SlotConfiguration<Kind>;
  readonly context: SlotPlanningContext;
  readonly geometry: Omit<SpawnPlan<Kind>, "maxEmptyRows" | "quotas"> & {
    readonly maxEmptyRows: number | null;
  };
  readonly tuning: GameData["tuning"];
}

// Null represents an unlimited quiet-row bound in JSON diagnostic inputs.
export function compileZoneSlotInput<Kind extends string>(input: ZoneSlotInput<Kind>) {
  const geometry = { ...input.geometry, maxEmptyRows: input.geometry.maxEmptyRows ?? Infinity };
  const catalogue: readonly SlotKind<Kind>[] = input.catalogue.map((definition) => ({
    compile: (streams) => ({
      ...definition.spec,
      ...(definition.movement === null
        ? {}
        : {
            mover: {
              ...moverSpec(
                { tuning: input.tuning },
                streams,
                definition.footprint,
                definition.movement,
              ),
              ...(definition.movingHitLength === undefined
                ? {}
                : { hitLength: definition.movingHitLength }),
            },
          }),
    }),
    footprint: definition.footprint,
    kind: definition.kind,
    role: definition.role,
    weight: definition.weight,
  }));
  return { catalogue, geometry };
}
export function replayZoneSlots<Kind extends string>(
  input: ZoneSlotInput<Kind>,
): SlotPlanningResult<Kind> {
  const { catalogue, geometry } = compileZoneSlotInput(input);
  return planSlotSpawns(input.context, geometry, catalogue, input.auxiliary, input.config);
}

// Offline capacity construction is independent of a runtime layout or prefix.
export function replayZoneCapacity<Kind extends string>(
  input: ZoneSlotInput<Kind>,
): SlotCapacityResult<Kind> {
  const { catalogue, geometry } = compileZoneSlotInput(input);
  return planSlotCapacity(input.context, geometry, catalogue, input.auxiliary, input.config);
}

export class ZoneSlotPlanningError<Kind extends string> extends SlotPlanningError<Kind> {
  readonly input: ZoneSlotInput<Kind>;
  constructor(
    input: ZoneSlotInput<Kind>,
    result: Extract<SlotPlanningResult<Kind>, { readonly status: "unsupported" }>,
  ) {
    super(result);
    this.input = input;
    const zone = input.actualRun.route[input.actualRun.zoneIndex] ?? "unknown";
    this.message = `Zone ${zone}, seed ${input.context.seed}, position ${input.context.zoneIndex}: ${this.message}`;
    this.name = "ZoneSlotPlanningError";
  }
}
