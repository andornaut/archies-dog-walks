import type { SlotFailure, SlotLimits } from "./slotConfig.ts";
import type { SlotAttemptDiagnostics, SlotDiagnostics } from "./slotPlanner.ts";
import type { WitnessWork } from "./slotWitnessSearch.ts";

export function createSlotWorkMeter<Kind extends string>(
  limits: SlotLimits,
  maximum: SlotLimits,
  failed: () => boolean,
  failConstruction: (failure: SlotFailure<Kind>) => void,
) {
  const attempts: SlotAttemptDiagnostics[] = [];
  let attemptStart = { candidateChecks: 0, propagationChecks: 0 };
  let attemptFloor: SlotAttemptDiagnostics["firstFloor"];
  let attemptRestarted = false;
  let attemptStopped = false;
  const stats = {
    activeCommits: 0,
    anchors: 0,
    audits: 0,
    candidateChecks: 0,
    certificateTemplates: 0,
    commits: 0,
    compiledTemplates: 0,
    profileCompiles: 0,
    propagationChecks: 0,
    rejections: {} as Record<string, number>,
  };
  const diagnostics = (): SlotDiagnostics => ({
    ...stats,
    attempts: [...attempts],
    rejections: { ...stats.rejections },
  });
  const pathBudget = (type: "anchors" | "candidateChecks") => {
    if (failed() || attemptStopped) {
      return false;
    }
    if (stats[type] >= limits[type]) {
      failConstruction({
        available: limits[type],
        code: type === "anchors" ? "anchor-budget" : "candidate-budget",
      });
      return false;
    }
    if (type === "candidateChecks" && stats[type] - attemptStart[type] >= maximum.candidateChecks) {
      attemptStopped = true;
      return false;
    }
    stats[type]++;
    return true;
  };
  const meter = {
    anchor: () => pathBudget("anchors"),
    check: () => pathBudget("candidateChecks"),
    progress: () => {
      const allowance = maximum.candidateChecks;
      const share = (type: "candidateChecks" | "propagationChecks") => {
        const used = stats[type] - attemptStart[type];
        const remaining = Math.max(
          0,
          Math.min(allowance - used, limits.candidateChecks - stats[type]),
        );
        return used + remaining === 0 ? 1 : used / (used + remaining);
      };
      return Math.max(share("candidateChecks"), share("propagationChecks"));
    },
    propagate: () => {
      if (failed() || attemptStopped) {
        return false;
      }
      if (stats.propagationChecks >= limits.candidateChecks) {
        failConstruction({ available: limits.candidateChecks, code: "propagation-budget" });
        return false;
      }
      if (stats.propagationChecks - attemptStart.propagationChecks >= maximum.candidateChecks) {
        attemptStopped = true;
        return false;
      }
      stats.propagationChecks++;
      return true;
    },
    stopped: () => failed() || attemptStopped,
  };
  const recordAttempt = (
    ordering: "original" | "balanced",
    status: SlotAttemptDiagnostics["status"],
  ) => {
    attempts.push({
      candidateChecks: stats.candidateChecks - attemptStart.candidateChecks,
      ...(attemptFloor === undefined ? {} : { firstFloor: attemptFloor }),
      ordering,
      propagationChecks: stats.propagationChecks - attemptStart.propagationChecks,
      reserveRestart: attemptRestarted,
      status,
    });
    attemptFloor = undefined;
    attemptRestarted = false;
  };

  const attemptProgress: Pick<WitnessWork<Kind>, "floorMet" | "rejected" | "reserveRestarted"> = {
    floorMet() {
      attemptFloor ??= {
        candidateChecks: stats.candidateChecks - attemptStart.candidateChecks,
        propagationChecks: stats.propagationChecks - attemptStart.propagationChecks,
      };
    },
    rejected(candidate, failure) {
      const key = `${candidate.prepared.source.kind}:${failure.rule}`;
      stats.rejections[key] = (stats.rejections[key] ?? 0) + 1;
    },
    reserveRestarted() {
      attemptRestarted = true;
    },
  };

  return {
    attemptProgress,
    attemptStopped: () => attemptStopped,
    diagnostics,
    meter,
    recordAttempt,
    startAttempt() {
      attemptStart = {
        candidateChecks: stats.candidateChecks,
        propagationChecks: stats.propagationChecks,
      };
      attemptStopped = false;
    },
    stats,
  };
}
