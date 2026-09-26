// CLI fuer die Registry-Gates. Aufruf ueber npm:
//   npm run registry:parse | registry:schema | registry:referential-integrity
//   npm run registry:evidence | registry:policy-invariants | registry:check (alle)
// Optionen: --dir <registry-verzeichnis> (Default: registry), --schema <dir>
// (Default: <dir>/schema). Exit 0 = gruen, 1 = Befund, 2 = Fehlbedienung.

import { resolve } from 'node:path';
import { GATES, runAllGates, runGate, type GateName, type GateResult } from './lib.ts';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

function report(r: GateResult): void {
  const c = r.counts;
  const head = `[registry:${r.gate}] ${r.ok ? 'OK' : 'FEHLER'} – ${c.vendor} Vendor, ${c.deployment} Deployment, ${c.assessment} Assessment-Datei(en)`;
  console.log(head);
  for (const i of r.issues) console.log(`  ✗ ${i.file} [${i.code}] ${i.message}`);
}

async function main(): Promise<number> {
  const which = process.argv[2];
  const dir = resolve(arg('--dir') ?? 'registry');
  const schemaDir = resolve(arg('--schema') ?? `${dir}/schema`);
  if (which === 'all') {
    const results = await runAllGates(dir, schemaDir);
    results.forEach(report);
    return results.every((r) => r.ok) ? 0 : 1;
  }
  if (!which || !(GATES as readonly string[]).includes(which)) {
    console.error(`Aufruf: cli.ts <${GATES.join('|')}|all> [--dir registry] [--schema registry/schema]`);
    return 2;
  }
  const r = await runGate(which as GateName, dir, schemaDir);
  report(r);
  return r.ok ? 0 : 1;
}

main().then((code) => process.exit(code), (e) => { console.error(e); process.exit(2); });
