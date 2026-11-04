// Python's number semantics, which the art generators keep so their output is the same pixel for
// pixel: round() halves to even, % and // floor, :.Nf formats the exact binary value, and
// math.radians multiplies by pi / 180.

// The exact value of a finite double as sign, numerator and power-of-two denominator.
function exact(x: number): { den: bigint; negative: boolean; num: bigint } {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  const bits = view.getBigUint64(0);
  const negative = bits >> 63n === 1n;
  const exponent = Number((bits >> 52n) & 0x7ffn);
  const fraction = bits & 0xfffffffffffffn;
  const mantissa = exponent ? fraction | (1n << 52n) : fraction;
  const shift = (exponent || 1) - 1075;
  return shift >= 0
    ? { den: 1n, negative, num: mantissa << BigInt(shift) }
    : { den: 1n << BigInt(-shift), negative, num: mantissa };
}

// x to n decimal places as Python's f"{x:.{n}f}" writes it: the exact binary value rounded half to
// even, with the sign kept on a negative value that rounds to zero.
export function formatFixed(x: number, n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError("Places must be a nonnegative integer");
  }
  if (Number.isNaN(x)) {
    return "nan";
  }
  if (!Number.isFinite(x)) {
    return x > 0 ? "inf" : "-inf";
  }
  const { den, negative, num } = exact(x);
  const scaled = num * 10n ** BigInt(n);
  let q = scaled / den;
  const twice = 2n * (scaled % den);
  if (twice > den || (twice === den && q % 2n === 1n)) {
    q += 1n;
  }
  const digits = q.toString().padStart(n + 1, "0");
  const whole = digits.slice(0, digits.length - n);
  const sign = negative ? "-" : "";
  return n ? `${sign}${whole}.${digits.slice(digits.length - n)}` : `${sign}${whole}`;
}

// Python's round(x): the nearest integer, halves to even. An integer has no sign of zero.
export function roundHalfEven(x: number): number {
  const r = Math.abs(x % 1) === 0.5 ? 2 * Math.round(x / 2) : Math.round(x);
  return r + 0;
}

// Python's round(x, n): the double nearest x rounded half to even at n decimal places.
export function roundTo(x: number, n: number): number {
  return Number(formatFixed(x, n));
}

// Python's a % b: fmod, moved to the divisor's sign, and a zero remainder taking the divisor's sign.
export function floorMod(a: number, b: number): number {
  const mod = a % b;
  if (mod) {
    return b < 0 !== mod < 0 ? mod + b : mod;
  }
  return b < 0 ? -0 : 0;
}

// Python's a // b, as CPython divides floats.
export function floorDiv(a: number, b: number): number {
  const mod = a % b;
  let div = (a - mod) / b;
  if (mod && b < 0 !== mod < 0) {
    div -= 1;
  }
  if (!div) {
    const quotient = a / b;
    return quotient < 0 || Object.is(quotient, -0) ? -0 : 0;
  }
  let floor = Math.floor(div);
  if (div - floor > 0.5) {
    floor += 1;
  }
  return floor;
}

// Python's math.radians().
export function radians(degrees: number): number {
  return degrees * (Math.PI / 180);
}
