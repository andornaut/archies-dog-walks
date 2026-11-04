// JSON with every object's keys sorted, recursively: the string that
// JSON.stringify(value, sortKeys) gives, where sortKeys replaces each non-array object with a copy
// of its entries sorted by key. Plain data takes a direct walk; a value it cannot vouch for (a
// toJSON method, another prototype, a bigint or a cycle) takes JSON.stringify itself.
export function canonicalJson(value: unknown): string | undefined {
  try {
    return direct(value, new Set());
  } catch (error) {
    if (error !== indirect) {
      throw error;
    }
    return JSON.stringify(value, sortKeys);
  }
}

const indirect = {};
const ARRAY_INDEX = /^(?:0|[1-9]\d*)$/;

function sortKeys(_key: string, item: unknown): unknown {
  return item !== null && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
    : item;
}

// The serialisation of one value, or undefined where JSON omits it.
function direct(value: unknown, open: Set<object>): string | undefined {
  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "number":
      return Number.isFinite(value) ? String(value) : "null";
    case "boolean":
      return value ? "true" : "false";
    case "undefined":
    case "function":
    case "symbol":
      return undefined;
    case "bigint":
      throw indirect;
  }
  if (value === null) {
    return "null";
  }
  const item = value as object;
  const prototype = Object.getPrototypeOf(item) as unknown;
  const array = Array.isArray(item);
  if (
    open.has(item) ||
    (array
      ? prototype !== Array.prototype
      : prototype !== Object.prototype && prototype !== null) ||
    typeof (item as { toJSON?: unknown }).toJSON === "function"
  ) {
    throw indirect;
  }
  open.add(item);
  let text: string;
  if (array) {
    const values = item as readonly unknown[];
    const parts: string[] = [];
    for (let index = 0; index < values.length; index++) {
      parts.push(direct(values[index], open) ?? "null");
    }
    text = `[${parts.join(",")}]`;
  } else {
    // A sorted copy enumerates its array-index keys first, in numeric order, then the rest.
    const entries = Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const isIndex = (key: string) => ARRAY_INDEX.test(key) && Number(key) < 2 ** 32 - 1;
    const ordered = [
      ...entries.filter(([key]) => isIndex(key)).sort(([a], [b]) => Number(a) - Number(b)),
      ...entries.filter(([key]) => !isIndex(key)),
    ];
    const parts: string[] = [];
    for (const [key, field] of ordered) {
      const serialised = direct(field, open);
      if (serialised !== undefined) {
        parts.push(`${JSON.stringify(key)}:${serialised}`);
      }
    }
    text = `{${parts.join(",")}}`;
  }
  open.delete(item);
  return text;
}
