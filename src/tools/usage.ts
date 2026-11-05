// A caller mistake a CLI reports as a message, not a stack trace.
export class UsageError extends Error {}

// The exit code for a usage error, as command-line tools conventionally use.
export const USAGE_EXIT_CODE = 2;
