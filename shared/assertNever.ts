/**
 * Compile-time exhaustiveness guard for closed unions.
 *
 * Place this after a switch (or at the end of an if-chain) once every known
 * variant has been eliminated. Growing the union then fails compilation at
 * the unhandled consumer instead of falling through to a runtime default.
 */
export function assertNever(value: never, context?: string): never {
  const label = context ? `Unhandled ${context}` : 'Unhandled value';
  throw new Error(`${label}: ${String(value)}`);
}
