import { nativeSlotPreparationOrderingHint, type PreparedSlotKind } from "./slotCandidates.ts";
import type { SlotWitnessBudget, SlotWitnessConstructPorts } from "./slotWitnessConstructTypes.ts";
import { idealRowOrder, motionRank, rotatedColumns } from "./slotWitnessOrder.ts";
import type { WitnessJob } from "./slotWitnessSearch.ts";

export interface JobOrder<Kind extends string> {
  readonly fixed: boolean;
  readonly guaranteed: boolean;
  readonly key: string;
  readonly ordinal: number;
  readonly phase: WitnessJob<Kind>["phase"];
  readonly preparationMethod: WitnessJob<Kind>["preparations"];
  readonly total: number;
  readonly prepared: readonly PreparedSlotKind<Kind>[];
  readonly rows: readonly number[];
  readonly columns: ReadonlyMap<PreparedSlotKind<Kind>, readonly number[]>;
  readonly rank: number;
  readonly width: number;
  readonly envelopeWidth: number;
}

// Source lists live for one attempt, while the caller shares completed ordering metadata.
export function createWitnessJobOrdering<Kind extends string>(
  ports: Pick<SlotWitnessConstructPorts<Kind, unknown>, "preparations" | "propagate" | "stopped">,
  budget: Pick<SlotWitnessBudget, "exhaust" | "stopped">,
  geometry: { readonly laneCount: number },
  path: { readonly length: number },
  metadata: WeakMap<WitnessJob<Kind>, JobOrder<Kind>>,
) {
  const { exhaust, stopped } = budget;
  // A job's source sequence is fixed within one compiled problem; replay it once fully read.
  const preparationLists = new Map<WitnessJob<Kind>, readonly PreparedSlotKind<Kind>[]>();
  function* readPreparations(job: WitnessJob<Kind>): Generator<PreparedSlotKind<Kind>> {
    if (stopped()) {
      return;
    }
    const known = preparationLists.get(job);
    if (known !== undefined) {
      for (const prepared of known) {
        if (stopped()) {
          break;
        }
        yield prepared;
      }
      stopped();
      return;
    }
    const sources = ports.preparations(job);
    if (stopped()) {
      return;
    }
    const read: PreparedSlotKind<Kind>[] = [];
    let complete = true;
    for (const prepared of sources) {
      if (stopped()) {
        complete = false;
        break;
      }
      if (!ports.propagate()) {
        exhaust();
        complete = false;
        break;
      }
      if (stopped()) {
        complete = false;
        break;
      }
      read.push(prepared);
      yield prepared;
    }
    if (!stopped() && complete) {
      preparationLists.set(job, Object.freeze(read));
    }
  }
  const rowOrder = (job: WitnessJob<Kind>) => idealRowOrder(path.length, job);
  const columnOrder = (job: WitnessJob<Kind>, prepared: PreparedSlotKind<Kind>) =>
    rotatedColumns(geometry.laneCount, job, prepared);
  const matches = (job: WitnessJob<Kind>, order: JobOrder<Kind>) =>
    order.preparationMethod === job.preparations &&
    order.fixed === job.fixed &&
    order.guaranteed === job.guaranteed &&
    order.key === job.key &&
    order.ordinal === job.ordinal &&
    order.phase === job.phase &&
    order.total === job.total;
  const orderFor = (job: WitnessJob<Kind>): JobOrder<Kind> => {
    const cached = metadata.get(job);
    if (!stopped() && cached !== undefined && matches(job, cached)) {
      return cached;
    }
    const identity = {
      fixed: job.fixed,
      guaranteed: job.guaranteed,
      key: job.key,
      ordinal: job.ordinal,
      phase: job.phase,
      preparationMethod: job.preparations,
      total: job.total,
    };
    const prepared = Object.freeze([...readPreparations(job)]);
    let envelopeWidth = Infinity;
    for (const source of prepared) {
      if (stopped()) {
        break;
      }
      if (source.placements.length === 0) {
        envelopeWidth = Math.min(envelopeWidth, source.source.footprint.lanes);
        continue;
      }
      const native = nativeSlotPreparationOrderingHint(ports, source);
      if (native.status === "budget") {
        exhaust();
        break;
      }
      if (stopped()) {
        break;
      }
      if (native.status === "hint") {
        envelopeWidth = Math.min(envelopeWidth, native.hint.envelopeWidth);
        continue;
      }
      for (const placement of source.placements) {
        if (stopped() || !ports.propagate()) {
          exhaust();
          break;
        }
        envelopeWidth = Math.min(envelopeWidth, placement.lanes.count);
      }
      if (stopped()) {
        break;
      }
    }
    const order = Object.freeze({
      ...identity,
      columns: new Map(prepared.map((source) => [source, Object.freeze(columnOrder(job, source))])),
      envelopeWidth: Number.isFinite(envelopeWidth) ? envelopeWidth : 0,
      prepared,
      rank: Math.min(...prepared.map(motionRank)),
      rows: Object.freeze(rowOrder(job)),
      width: Math.max(0, ...prepared.map((source) => source.source.footprint.lanes)),
    });
    // Cache ordering metadata only after complete EOF. It never attests native admission.
    if (
      !stopped() &&
      matches(job, order) &&
      prepared.length > 0 &&
      prepared.every(
        (source) =>
          Object.isFrozen(source) &&
          Object.isFrozen(source.columns) &&
          Object.isFrozen(source.placements) &&
          Object.isFrozen(source.request),
      )
    ) {
      metadata.set(job, order);
    }
    return order;
  };
  return { columnOrder, orderFor, readPreparations, rowOrder };
}
