export interface FeasibilityWitness {
  readonly rule: string;
  readonly row?: number;
  readonly lastRow?: number;
  readonly mask?: number;
  readonly gap?: boolean;
  readonly moment?: number;
  readonly intrinsic?: boolean;
  readonly contributors?: readonly object[];
  readonly requests?: readonly string[];
}
export type FeasibilityObserver = (witness: FeasibilityWitness) => void;
