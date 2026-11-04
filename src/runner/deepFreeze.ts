const deeplyFrozen = new WeakSet<object>();

// Freezes a value and every object its own enumerable properties reach, the values JSON
// serialisation visits. Functions and typed arrays are left as they are, and a map's or set's
// entries are not visited. Returns the value.
export function deepFreeze<T>(value: T): T {
  if (
    value === null ||
    typeof value !== "object" ||
    ArrayBuffer.isView(value) ||
    deeplyFrozen.has(value)
  ) {
    return value;
  }
  deeplyFrozen.add(value);
  for (const key of Object.keys(value)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return Object.freeze(value);
}
