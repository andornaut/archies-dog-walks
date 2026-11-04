import { describe, expect, it } from "vitest";

import { textRoleCases } from "../testing/textRoles.ts";

const CASES = textRoleCases();

// Text never shrinks to fit: each role has one size, and sampled strings fit its room
// on no more than its lines.
describe("every text role", () => {
  it.each(CASES.map(({ overflow, role, text }) => [`${role}: ${text}`, overflow] as const))(
    "fits %s",
    (_name, overflow) => {
      expect(overflow).toBe("");
    },
  );
});
