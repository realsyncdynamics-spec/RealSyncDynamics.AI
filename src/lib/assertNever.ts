/**
 * Exhaustiveness sink. After every known variant is handled, the remainder
 * must be `never`. A new PlanId / result status that reaches here is a
 * compile error at the call site — not a silent default.
 */
export function assertNever(value: never, context?: string): never {
  throw new Error(
    context
      ? `Unhandled ${context}: ${String(value)}`
      : `Unhandled value: ${String(value)}`,
  );
}
