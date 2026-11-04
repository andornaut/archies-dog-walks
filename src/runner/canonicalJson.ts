// JSON with every object's keys sorted, recursively. An object whose own keys are already in
// sorted order serialises as itself, which a sorted copy of its entries would reproduce key for
// key; any other object serialises as that sorted copy.
export function canonicalJson(value: unknown): string | undefined {
  return JSON.stringify(value, sortKeys);
}

function sortKeys(_key: string, item: unknown): unknown {
  if (item === null || typeof item !== "object" || Array.isArray(item)) {
    return item;
  }
  const keys = Object.keys(item);
  for (let index = 1; index < keys.length; index++) {
    if (!(keys[index - 1]! < keys[index]!)) {
      return Object.fromEntries(
        Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      );
    }
  }
  return item;
}
