/**
 * Werkzeugkatalog des MCP-Servers.
 *
 * Die Beschreibungen sind für ein Modell geschrieben, nicht für Menschen: sie
 * sagen ausdrücklich, was ein Werkzeug NICHT leistet. Ein Modell, das
 * `evidence_search` für eine Bedeutungssuche hält oder aus `valid: true` eine
 * kryptografisch bestätigte Unversehrtheit ableitet, gibt in einem
 * Compliance-Produkt eine falsche Auskunft.
 */

import type { McpToolDefinition, McpToolResult } from './protocol.js';
import {
  listEvidence,
  getEvidence,
  verifyHashChain,
  searchEvidenceByControl,
} from '../tools/evidence.js';
import { getGovernanceStatus, listControls, checkComplianceStatus } from '../tools/governance.js';

export const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'evidence_list',
    scope: 'evidence.read',
    description:
      'Listet Compliance-Nachweise (Evidence-Snapshots) des Tenants, neueste zuerst. ' +
      'Nur lesend. subject_ref ist ein exakter Bezeichner, KEIN Suchbegriff.',
    inputSchema: {
      type: 'object',
      properties: {
        subject_ref: { type: 'string', description: 'Exakter Bezeichner, z. B. "iso42001/A.5".' },
        limit: { type: 'integer', description: 'Höchstzahl Treffer (Standard 50).' },
      },
    },
  },
  {
    name: 'evidence_get',
    scope: 'evidence.read',
    description: 'Liefert einen einzelnen Evidence-Snapshot anhand seiner ID.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'UUID des Snapshots.' } },
      required: ['id'],
    },
  },
  {
    name: 'evidence_verify_chain',
    scope: 'evidence.read',
    description:
      'Verifiziert die Hash-Kette des Subjects, zu dem der Snapshot gehört: Versionsfolge, ' +
      'Verkettung und Nachrechnung des event_hash. Snapshots ohne event_timestamp zählen als ' +
      '"legacy" und sind nur strukturell prüfbar — sie sind NICHT manipuliert. Bei ' +
      'cryptoVerified = 0 ist valid = true eine Aussage über die Struktur, nicht über die ' +
      'Kryptografie; das muss in der Antwort an den Nutzer mitgesagt werden.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'UUID eines Snapshots der Kette.' } },
      required: ['id'],
    },
  },
  {
    name: 'evidence_search_by_control',
    scope: 'evidence.read',
    description:
      'Sucht Evidence-Snapshots, deren subject_ref die Control-Kennung als Text enthält. ' +
      'Reiner Textabgleich, KEINE Bedeutungssuche: verwandte Nachweise mit anderer ' +
      'Benennung werden nicht gefunden. Ein leeres Ergebnis belegt daher nicht, dass es ' +
      'keine Nachweise gibt.',
    inputSchema: {
      type: 'object',
      properties: { control_id: { type: 'string', description: 'z. B. "A.5" oder "iso42001".' } },
      required: ['control_id'],
    },
  },
  {
    name: 'governance_status',
    scope: 'governance.read',
    description:
      'Compliance-Stand eines Frameworks. NOCH NICHT IMPLEMENTIERT — liefert einen Fehler. ' +
      'Daraus darf kein Score und keine Konformitätsaussage abgeleitet werden.',
    inputSchema: {
      type: 'object',
      properties: { framework_id: { type: 'string', description: 'Standard "iso-42001".' } },
    },
  },
  {
    name: 'governance_list_controls',
    scope: 'governance.read',
    description:
      'Controls eines Frameworks. NOCH NICHT IMPLEMENTIERT — liefert einen Fehler.',
    inputSchema: {
      type: 'object',
      properties: { framework_id: { type: 'string', description: 'Standard "iso-42001".' } },
    },
  },
  {
    name: 'governance_check_control',
    scope: 'governance.read',
    description:
      'Erfüllungsstand eines einzelnen Controls. NOCH NICHT IMPLEMENTIERT — liefert einen Fehler.',
    inputSchema: {
      type: 'object',
      properties: { control_id: { type: 'string' } },
      required: ['control_id'],
    },
  },
];

function asText(value: unknown): McpToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

function requireString(args: Record<string, unknown>, key: string): string {
  const v = args[key];
  if (typeof v !== 'string' || !v.trim()) {
    throw new Error(`Argument "${key}" fehlt oder ist leer.`);
  }
  return v;
}

/** Führt ein Werkzeug für den angegebenen Tenant aus. */
export async function invokeTool(
  tenantId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<McpToolResult> {
  switch (name) {
    case 'evidence_list': {
      const subjectRef = typeof args.subject_ref === 'string' ? args.subject_ref : undefined;
      const limit = typeof args.limit === 'number' ? args.limit : 50;
      const data = await listEvidence(tenantId, subjectRef, limit);
      return asText({ count: data.length, evidence: data });
    }

    case 'evidence_get': {
      const found = await getEvidence(tenantId, requireString(args, 'id'));
      if (!found) {
        return {
          content: [{ type: 'text', text: 'Kein Snapshot mit dieser ID in diesem Tenant.' }],
          isError: true,
        };
      }
      return asText(found);
    }

    case 'evidence_verify_chain':
      return asText(await verifyHashChain(tenantId, requireString(args, 'id')));

    case 'evidence_search_by_control': {
      const data = await searchEvidenceByControl(tenantId, requireString(args, 'control_id'));
      return asText({ count: data.length, evidence: data });
    }

    case 'governance_status': {
      const framework = typeof args.framework_id === 'string' ? args.framework_id : 'iso-42001';
      return asText(await getGovernanceStatus(tenantId, framework));
    }

    case 'governance_list_controls': {
      const framework = typeof args.framework_id === 'string' ? args.framework_id : 'iso-42001';
      return asText(await listControls(tenantId, framework));
    }

    case 'governance_check_control':
      return asText(await checkComplianceStatus(tenantId, requireString(args, 'control_id')));

    default:
      throw new Error(`Unbekanntes Werkzeug: ${name}`);
  }
}
