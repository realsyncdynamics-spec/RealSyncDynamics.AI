/**
 * RealSyncDynamicsAI — n8n Custom-Node-Skeleton.
 *
 * Sendet einen Telemetry-Event ans Compliance-OS aus einem n8n-Workflow.
 * Use-Case: bei jedem AI-Call in einem n8n-Workflow vor oder nach dem
 * Vendor-Node diesen Node platzieren — der Compliance-Trail wird damit
 * automatisch gefuellt.
 *
 * Bauen + Installation:
 *   1. cd connectors/n8n/ && npm install
 *   2. tsc --module commonjs --target es2020 RsdAiTelemetry.node.ts
 *   3. In ~/.n8n/custom/ verlinken oder als Community-Node packagen
 *
 * Aktuell: Skeleton-Code mit Type-Stubs. Folge-PR liefert echtes
 * @realsyncdynamicsai/n8n-nodes Package mit publishbarem package.json
 * + Icon + Credentials-Type.
 */

// Minimaler Type-Stub fuer n8n-workflow IExecuteFunctions / INodeType.
// Real-Build importiert aus 'n8n-workflow' — hier auf any/unknown reduziert
// damit das File ohne n8n-Dependency type-checkt.
type IExecuteFunctions = {
  getInputData(): Array<{ json: Record<string, unknown> }>;
  getNodeParameter(name: string, itemIndex: number): unknown;
  getCredentials(name: string): Promise<{ endpoint: string; tenantKey: string }>;
  helpers: { httpRequest(opts: Record<string, unknown>): Promise<unknown> };
};

interface INodeExecutionData {
  json: Record<string, unknown>;
}

export class RsdAiTelemetry {
  description = {
    displayName: 'RealSyncDynamicsAI Telemetry',
    name: 'rsdAiTelemetry',
    group: ['transform'],
    version: 1,
    description: 'Sendet AI-Runtime-Events ans RealSyncDynamicsAI Compliance-OS',
    defaults: { name: 'RSD AI Telemetry' },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [{ name: 'rsdAiCredentialsApi', required: true }],
    properties: [
      {
        displayName: 'Vendor',
        name: 'vendor',
        type: 'options',
        options: [
          { name: 'OpenAI', value: 'openai' },
          { name: 'Anthropic', value: 'anthropic' },
          { name: 'Google', value: 'google' },
          { name: 'Microsoft', value: 'microsoft' },
          { name: 'Other', value: 'other' },
        ],
        default: 'openai',
      },
      {
        displayName: 'Model',
        name: 'model',
        type: 'string',
        default: '',
        description: 'z.B. gpt-4.1, claude-opus-4-7',
      },
      {
        displayName: 'Event Type',
        name: 'eventType',
        type: 'options',
        options: [
          { name: 'prompt_sent', value: 'prompt_sent' },
          { name: 'response_received', value: 'response_received' },
          { name: 'agent_action', value: 'agent_action' },
          { name: 'tool_call', value: 'tool_call' },
          { name: 'file_upload', value: 'file_upload' },
        ],
        default: 'response_received',
      },
      {
        displayName: 'Prompt Category',
        name: 'promptCategory',
        type: 'options',
        options: [
          { name: 'code_generation', value: 'code_generation' },
          { name: 'content_generation', value: 'content_generation' },
          { name: 'classification', value: 'classification' },
          { name: 'summarization', value: 'summarization' },
          { name: 'translation', value: 'translation' },
          { name: 'extraction', value: 'extraction' },
          { name: 'agent_action', value: 'agent_action' },
          { name: 'analysis', value: 'analysis' },
          { name: 'qa', value: 'qa' },
          { name: 'unknown', value: 'unknown' },
        ],
        default: 'unknown',
      },
      {
        displayName: 'Data Class',
        name: 'dataClass',
        type: 'options',
        options: [
          { name: 'public', value: 'public' },
          { name: 'internal', value: 'internal' },
          { name: 'confidential', value: 'confidential' },
          { name: 'personal_data', value: 'personal_data' },
          { name: 'special_category', value: 'special_category' },
          { name: 'unknown', value: 'unknown' },
        ],
        default: 'unknown',
      },
      {
        displayName: 'Risk Level',
        name: 'riskLevel',
        type: 'options',
        options: [
          { name: 'info', value: 'info' },
          { name: 'low', value: 'low' },
          { name: 'medium', value: 'medium' },
          { name: 'high', value: 'high' },
          { name: 'critical', value: 'critical' },
        ],
        default: 'info',
      },
      {
        displayName: 'Team',
        name: 'team',
        type: 'string',
        default: '',
        description: 'Optional. z.B. Engineering / Sales / Legal',
      },
      {
        displayName: 'Metadata (JSON)',
        name: 'metadata',
        type: 'json',
        default: '{}',
        description: 'Strukturierter Kontext (kein Prompt-Text!)',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const credentials = await this.getCredentials('rsdAiCredentialsApi');
    const out: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const payload = {
        vendor: this.getNodeParameter('vendor', i),
        model: this.getNodeParameter('model', i),
        event_type: this.getNodeParameter('eventType', i),
        prompt_category: this.getNodeParameter('promptCategory', i),
        data_class: this.getNodeParameter('dataClass', i),
        risk_level: this.getNodeParameter('riskLevel', i),
        team: this.getNodeParameter('team', i) || undefined,
        metadata: this.getNodeParameter('metadata', i) ?? {},
        occurred_at: new Date().toISOString(),
      };

      const response = (await this.helpers.httpRequest({
        method: 'POST',
        url: credentials.endpoint,
        headers: {
          'content-type': 'application/json',
          'x-rsd-tenant-key': credentials.tenantKey,
        },
        body: payload,
        json: true,
      })) as { ok: boolean; event_id?: string; policy_status?: string };

      out.push({
        json: {
          ...items[i].json,
          rsd_telemetry: response,
        },
      });
    }

    return [out];
  }
}
