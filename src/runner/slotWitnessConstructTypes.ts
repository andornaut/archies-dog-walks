import type {
  SlotCandidate,
  SlotCandidateOrder,
  SlotFrontierSequenceStep,
  SlotMotionTiers,
} from "./slotCandidateDomains.ts";
import type { PreparedSlotKind } from "./slotCandidates.ts";
import type { ConstraintEntry, ConstraintResult } from "./slotConstraintState.ts";
import type { WitnessJob, WitnessOmission } from "./slotWitnessSearch.ts";

export type Rejection<Kind extends string> = Extract<ConstraintResult<Kind>, { accepted: false }>;
export interface SlotWitnessConstructPorts<Kind extends string, Mark> {
  // Deliveries of the best certified floor-meeting partial layout, if any.
  bestDelivery(): number | undefined;
  candidates(
    job: WitnessJob<Kind>,
    prepared: PreparedSlotKind<Kind>,
    order: SlotCandidateOrder,
  ): Iterable<SlotFrontierSequenceStep<Kind>>;
  checkpoint(): Mark;
  complete(): { readonly accepted: true } | Rejection<Kind> | undefined;
  entries(): readonly ConstraintEntry<Kind>[];
  // Draw tuples' native values, tried before later retry tuples.
  motionTiers(prepared: PreparedSlotKind<Kind>): SlotMotionTiers;
  readonly minimumDelivery: number;
  // Failed placement attempts before a frame may omit its optional request.
  readonly omissionAttempts: number;
  readonly ordinaryOrder: "original" | "balanced";
  partial(omissions: readonly WitnessOmission<Kind>[]): boolean | undefined;
  laneClosure(): { readonly accepted: true } | Rejection<Kind> | undefined;
  preparations(job: WitnessJob<Kind>): Iterable<PreparedSlotKind<Kind>>;
  propagate(): boolean;
  // Whether a recorded rejection of this choice still holds for the current entries.
  rejects(job: WitnessJob<Kind>, candidate: SlotCandidate<Kind>): boolean;
  repairRow():
    { readonly row: number; readonly status: "row" } | { readonly status: "none" | "budget" };
  restore(mark: Mark): void;
  stopped(): boolean;
  test(job: WitnessJob<Kind>, candidate: SlotCandidate<Kind>): ConstraintResult<Kind> | undefined;
}
export type SlotWitnessConstructResult<Kind extends string> =
  | {
      readonly coverageKey?: string;
      readonly status: "compatible";
      readonly witness: readonly ConstraintEntry<Kind>[];
    }
  | { readonly status: "inconclusive" }
  | { readonly failure: Rejection<Kind>["failure"]; readonly status: "blocked" }
  | { readonly status: "budget" };
export interface Option<Kind extends string> {
  readonly job: WitnessJob<Kind>;
  readonly candidate: SlotCandidate<Kind>;
}
export type Choice<Kind extends string> =
  | {
      readonly continuation?: { readonly defer: () => void; readonly preferClear: boolean };
      readonly option: Option<Kind>;
      readonly status: "candidate";
    }
  | { readonly status: "source-end" }
  | { readonly status: "tier-end" };
// Occupancy rejections per row within one frame, and the row each yielded value was drawn from.
export interface RowPressure<Kind extends string> {
  readonly rejections: Map<number, number>;
  readonly rows: Map<SlotCandidate<Kind>, number>;
}
// A quiet-coverage scan over the leading quiet rows. Anchored scans try only blocking sources at
// rows whose footprint covers a leading row; blocking scans yield only values that cover one and
// defer the rest; open scans yield every value, leading rows first.
interface CoverageScan {
  readonly filter: "anchored" | "blocking" | "open";
  readonly leading: readonly number[];
}
// How one frame enumerates a job's sources: the rows and columns to try, a repair row to try
// first, an optional coverage scan, where blocking scans defer values and the frame's row pressure.
export interface SourceScan<Kind extends string> {
  readonly columns?: ReadonlyMap<PreparedSlotKind<Kind>, readonly number[]>;
  readonly coverage?: CoverageScan;
  readonly deferred?: Option<Kind>[];
  readonly pressure?: RowPressure<Kind>;
  readonly repairRow?: number;
  readonly rows: readonly number[];
}
export interface SlotWitnessBudget {
  charge(): boolean;
  exhaust(): void;
  stopped(): boolean;
}
