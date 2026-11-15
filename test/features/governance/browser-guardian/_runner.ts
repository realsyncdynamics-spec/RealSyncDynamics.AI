// Gleiche Tests unter Vitest (CI, `npm test`) und `node --test` (ohne
// node_modules). Assertions über node:assert — wirft in beiden Runnern.
type Body = () => void | Promise<void>;
type Register = (name: string, fn: Body) => void;

const runner = process.env.VITEST ? await import('vitest') : await import('node:test');

export const describe = runner.describe as unknown as Register;
export const it = runner.it as unknown as Register;
