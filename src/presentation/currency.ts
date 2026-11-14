import { signedText } from "@andornaut/game-kit/lines";

import { type Cents, cents } from "../units.ts";

// Money is counted in cents and shown in whole dollars, with thousands separated.
export function dollarText(amount: Cents): string {
  return `$${dollarAmountText(amount)}`;
}

// dollarText without its "$", for a screen that draws the "$" apart.
export function dollarAmountText(amount: Cents): string {
  return Math.floor(amount / 100).toLocaleString("en-US");
}

// The short form's units, each a thousand times the one before it, from a thousand.
const SHORT_UNITS = ["k", "M", "B", "T"] as const;

// dollarAmountText at most three digits long, rounded down, for a slot too narrow for the full
// amount: whole dollars under a thousand, else in the largest unit it reaches, with one decimal
// under ten of it ("1.2k", "12k", "123M", "1.2B").
export function shortDollarAmountText(amount: Cents): string {
  const dollars = Math.floor(amount / 100);
  const place = SHORT_UNITS.filter((_, i) => dollars >= 1_000 ** (i + 1)).length - 1;
  const unit = SHORT_UNITS[place];
  if (unit === undefined) {
    return String(dollars);
  }
  const tenths = Math.floor(dollars / (1_000 ** (place + 1) / 10));
  return tenths < 100 ? `${tenths / 10}${unit}` : `${Math.floor(tenths / 10)}${unit}`;
}

// A change in money with its sign: "+$240", "−$12".
export function signedDollarText(amount: number): string {
  return signedText(amount, dollarText(cents(Math.abs(amount))));
}

// signedDollarText in the short form, for a column too narrow for the full amount: "+$240",
// "−$1.2k", and an amount under a whole dollar either way as "$0", with no sign.
export function signedShortDollarText(amount: number): string {
  const dollars = `$${shortDollarAmountText(cents(Math.abs(amount)))}`;
  return Math.abs(amount) < 100 ? dollars : signedText(amount, dollars);
}
