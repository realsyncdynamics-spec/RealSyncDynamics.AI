/**
 * Exhaustiveness sink. A switch/if chain that still has a value here is missing a variant.
 * Assigning that value to `never` is the compile-time check; the throw is the runtime net.
 */
export function assertNever(value: never, label = 'unhandled union member'): never {
  throw new Error(`${label}: ${safeDescribe(value)}`);
}

function safeDescribe(value: unknown): string {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean' || t === 'bigint') return String(value);
  if (t === 'undefined') return 'undefined';
  try {
    return JSON.stringify(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}
