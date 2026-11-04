import type { MovementKind } from "../data/types.ts";

// A failed candidate check, not proof that no arrangement can admit the quota.
export type SpawnRejection =
  | "body"
  | "cells"
  | "geometry"
  | "kind-cap"
  | "kind-entry"
  | "kind-lane"
  | "kind-row"
  | "open-lanes"
  | "outside-road"
  | "outside-rows"
  | "outside-zone"
  | "pack-gap"
  | "path-stop"
  | "reservation"
  | "rider-gap"
  | "screen-cap"
  | "wide-gap";

interface CapacityLimit {
  readonly available: number;
  readonly required: number;
  readonly resource: string;
}

// Necessary bounds only: passing them does not prove that a legal arrangement exists.
export interface SpawnCapacity {
  readonly limits: readonly CapacityLimit[];
  readonly rows: number;
}

export interface AdmissionReport<Kind extends string> {
  readonly capacity: SpawnCapacity;
  readonly placement?: {
    readonly missing: readonly {
      readonly count: number;
      readonly kind: Kind;
      readonly movement: MovementKind | null;
      readonly reasons: readonly SpawnRejection[];
    }[];
    readonly placed: number;
    readonly ratio: number;
    readonly requested: number;
  };
  // Counts are logical groups: a delayed trail is one mover, regardless of its components.
  readonly counts: readonly {
    readonly admitted: number;
    readonly herrings: number;
    readonly kind: Kind;
    readonly movement: MovementKind | null;
    readonly requested: number;
  }[];
  // These count failed candidate checks, including candidates of movers eventually admitted.
  readonly rejections: readonly {
    readonly candidates: number;
    readonly kind: Kind;
    readonly reason: SpawnRejection;
  }[];
  readonly substitutions: readonly { readonly from: Kind; readonly to: Kind }[];
}
