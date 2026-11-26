import { isHerring } from "./dartOutcomes.ts";
import { deepFreeze } from "./deepFreeze.ts";
import { drawMover } from "./moverDraws.ts";
import type { MoverDraws, MoverPlacement, MoverStreams } from "./moverModel.ts";
import { slotFootprint, type SlotSource } from "./slotConfig.ts";
import {
  compileSlotDomain,
  compileSlotKindDomain,
  type NativeMotionCapture,
  type NativeMotionIndex,
} from "./slotDomainCompile.ts";
import type { SpawnPlan, SpawnQuota } from "./spawning.ts";

export type Geometry<Kind extends string> = Omit<SpawnPlan<Kind>, "quotas">;
// A source profile that does not compile, or compiles to a request inconsistent with its role or
// footprint. A compile failure is kept as the cause.
export class SlotProfileError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SlotProfileError";
  }
}

export interface SlotKindDescriptor<Kind extends string> {
  readonly draws?: MoverDraws;
  readonly herring: boolean;
  readonly request: SpawnQuota<Kind>;
  readonly source: SlotSource<Kind>;
}
export interface PreparedSlotKind<Kind extends string> extends SlotKindDescriptor<Kind> {
  readonly compiledCount: number;
  readonly columns: readonly number[];
  readonly placements: readonly MoverPlacement[];
}
export interface SlotPreparationWork {
  template(): boolean;
}
export interface SlotPreparationOrdering {
  readonly envelopeWidth: number;
}
export type SlotPreparationOrderingHintResult =
  | { readonly hint: SlotPreparationOrdering; readonly status: "hint" }
  | { readonly status: "unknown" }
  | { readonly kind: "propagation"; readonly status: "budget" };
export type SlotPreparationResult<Kind extends string> =
  | { readonly prepared: PreparedSlotKind<Kind>; readonly status: "complete" }
  | { readonly status: "budget" };

// Native preparations are deeply frozen, borrowed source and profile included, so a registered
// preparation keeps the shape it was compiled with.
const nativePreparations = new WeakMap<
  PreparedSlotKind<string>,
  {
    readonly hasStops: boolean;
    readonly motion: NativeMotionIndex | undefined;
    readonly ordering: SlotPreparationOrdering;
  }
>();

function nativePreparation<Kind extends string>(
  motion: NativeMotionIndex | undefined,
  prepared: PreparedSlotKind<Kind>,
): PreparedSlotKind<Kind> {
  let hasStops = false;
  let envelopeWidth = prepared.placements.length === 0 ? prepared.source.footprint.lanes : Infinity;
  for (const placement of prepared.placements) {
    envelopeWidth = Math.min(envelopeWidth, placement.lanes.count);
    hasStops ||= placement.stop !== undefined;
  }
  deepFreeze(prepared);
  nativePreparations.set(prepared, {
    hasStops,
    motion,
    ordering: Object.freeze({ envelopeWidth }),
  });
  return prepared;
}

export function isNativeSlotPreparation(prepared: PreparedSlotKind<string>): boolean {
  return nativePreparations.has(prepared);
}

// This preparation-time hint only orders choices; it never attests admission, row support or a
// complete domain traversal.
export function nativeSlotPreparationOrderingHint(
  work: { readonly propagate: () => boolean },
  prepared: PreparedSlotKind<string>,
): SlotPreparationOrderingHintResult {
  if (!work.propagate()) {
    return { kind: "propagation", status: "budget" };
  }
  const origin = nativePreparations.get(prepared);
  return origin === undefined ? { status: "unknown" } : { hint: origin.ordering, status: "hint" };
}

export function prepareSlotKind<Kind extends string>(
  streams: MoverStreams,
  geometry: Geometry<Kind>,
  source: SlotSource<Kind>,
): PreparedSlotKind<Kind> {
  return nativePreparation(
    undefined,
    compileSlotKindDomain(undefined, geometry, describeSlotKind(streams, source)),
  );
}

export function prepareSlotKindWithin<Kind extends string>(
  work: SlotPreparationWork,
  streams: MoverStreams,
  geometry: Geometry<Kind>,
  source: SlotSource<Kind>,
): SlotPreparationResult<Kind> {
  const exhausted = {};
  try {
    const descriptor = describeSlotKind(streams, source);
    const compile = source.compile;
    const capture: NativeMotionCapture = {};
    const prepared = compileSlotDomain(
      {
        beforePlacement() {
          if (!work.template()) {
            throw exhausted;
          }
        },
      },
      geometry,
      capture,
      descriptor,
    );
    return {
      prepared: nativePreparation(compile === source.compile ? capture.index : undefined, prepared),
      status: "complete",
    };
  } catch (error) {
    if (error === exhausted) {
      return { status: "budget" };
    }
    throw error;
  }
}

export function describeSlotKind<Kind extends string>(
  streams: MoverStreams,
  source: SlotSource<Kind>,
): SlotKindDescriptor<Kind> {
  let compiled: ReturnType<SlotSource<Kind>["compile"]>;
  try {
    compiled = source.compile(streams);
  } catch (error) {
    throw new SlotProfileError(`Slot profile does not compile: ${source.role}:${source.kind}`, {
      cause: error,
    });
  }
  const hazard = source.role !== "auxiliaryFixed" && source.role !== "auxiliaryMoving";
  if (compiled.hazard !== undefined && compiled.hazard !== hazard) {
    throw new SlotProfileError(`Slot hazard role mismatch: ${source.role}:${source.kind}`);
  }
  const request: SpawnQuota<Kind> = { ...compiled, count: 1, hazard, kind: source.kind };
  const footprint = slotFootprint(request);
  if (footprint.lanes !== source.footprint.lanes || footprint.rows !== source.footprint.rows) {
    throw new SlotProfileError(`Slot footprint mismatch: ${source.role}:${source.kind}`);
  }
  const moving =
    source.role === "encounterMoving" ||
    source.role === "minorMoving" ||
    source.role === "auxiliaryMoving";
  if (moving !== (request.mover !== undefined)) {
    throw new SlotProfileError(`Slot profile role mismatch: ${source.role}:${source.kind}`);
  }
  if (request.mover === undefined) {
    return { herring: false, request, source };
  }
  const draws = drawMover(streams.draws);
  return { draws, herring: isHerring(request.mover, draws), request, source };
}

// Reads the original producer facts without exposing the preparation registry.
export function nativeSlotPreparationOf(prepared: PreparedSlotKind<string>) {
  return nativePreparations.get(prepared);
}
