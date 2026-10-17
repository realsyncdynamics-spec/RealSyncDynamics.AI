// System-DNS für den Node-Executor (Container). Getrennt von netguard.ts,
// damit der laufzeitneutrale Kern ohne node:-Import auskommt.

import { lookup } from 'node:dns/promises';
import type { Resolver } from './netguard.js';

export const nodeResolver: Resolver = async (host) => {
  const entries = await lookup(host, { all: true, verbatim: true });
  return entries.map((e) => e.address);
};
