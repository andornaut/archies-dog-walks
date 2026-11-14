import { describe, expect, it } from "vitest";

import { cents } from "../units.ts";
import {
  dollarAmountText,
  dollarText,
  shortDollarAmountText,
  signedDollarText,
  signedShortDollarText,
} from "./currency.ts";

const dollars = (amount: number) => cents(amount * 100);

describe("money text", () => {
  it("shows cents in whole dollars with thousands separated, signed or not", () => {
    const cases: readonly [string, (amount: number) => string, number, string][] = [
      ["dollarText", (amount) => dollarText(cents(amount)), dollars(800), "$800"],
      ["dollarText", (amount) => dollarText(cents(amount)), dollars(1800), "$1,800"],
      ["dollarText", (amount) => dollarText(cents(amount)), 6_450, "$64"],
      ["dollarAmountText", (amount) => dollarAmountText(cents(amount)), dollars(1800), "1,800"],
      ["dollarAmountText", (amount) => dollarAmountText(cents(amount)), 4_299, "42"],
      ["signedDollarText", signedDollarText, dollars(240), "+$240"],
      ["signedDollarText", signedDollarText, -dollars(1200), "−$1,200"],
      ["signedDollarText", signedDollarText, -1_250, "−$12"],
      ["signedShortDollarText", signedShortDollarText, dollars(240), "+$240"],
      ["signedShortDollarText", signedShortDollarText, -dollars(1234), "−$1.2k"],
      ["signedShortDollarText", signedShortDollarText, 0, "$0"],
      ["signedShortDollarText", signedShortDollarText, 99, "$0"],
      ["signedShortDollarText", signedShortDollarText, -99, "$0"],
      ["signedShortDollarText", signedShortDollarText, 100, "+$1"],
    ];
    for (const [, text, amount, shown] of cases) {
      expect(text(amount)).toBe(shown);
    }
  });

  it("shortDollarAmountText shows cents at most three digits, rounded down", () => {
    const cases: readonly [number, string][] = [
      [4_299, "42"],
      [dollars(999), "999"],
      [dollars(1_000), "1k"],
      [dollars(1_234), "1.2k"],
      [dollars(12_345), "12k"],
      [dollars(999_999), "999k"],
      [dollars(1_000_000), "1M"],
      [dollars(1_234_567), "1.2M"],
      [dollars(123_456_789), "123M"],
      [dollars(1_234_567_890), "1.2B"],
      [dollars(12_345_678_901), "12B"],
      [dollars(123_456_789_012), "123B"],
      [Number.MAX_SAFE_INTEGER, "90T"],
    ];
    for (const [amount, shown] of cases) {
      expect(shortDollarAmountText(cents(amount))).toBe(shown);
    }
  });
});
