import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const parse = `const result = $input.first().json;
const text = result.content?.find(item => item.type === 'text')?.text;
const value = result.structuredContent ?? (typeof text === 'string' ? JSON.parse(text) : text);
if (!value || value.error) throw new Error(value?.error || 'Tellseed returned no usable result');`;
const nodes = [
  { id: 'manual', name: 'Run manually', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, position: [0, 0], parameters: {} },
  { id: 'campaign', name: 'Campaign', type: 'n8n-nodes-base.set', typeVersion: 3.4, position: [220, 0], parameters: {
    assignments: { assignments: [
      { id: 'campaignId', name: 'campaignId', type: 'string', value: 'REPLACE_WITH_YOUR_CAMPAIGN_ID' },
      { id: 'seed', name: 'seed', type: 'string', value: 'tellseed-n8n-v1' },
    ] }, options: {},
  } },
  { id: 'get', name: 'Read campaign', type: '@n8n/n8n-nodes-langchain.mcpClient', typeVersion: 1.1, position: [440, 0], parameters: {
    serverTransport: 'httpStreamable', endpointUrl: 'https://app.tellseed.com/mcp', authentication: 'bearerAuth',
    tool: { __rl: true, mode: 'id', value: 'campaign_get' }, inputMode: 'json',
    jsonInput: '={{ { campaignId: $json.campaignId } }}', options: { timeout: 30000, convertToBinary: false },
  } },
  { id: 'check', name: 'Check campaign', type: 'n8n-nodes-base.code', typeVersion: 2, position: [660, 0], parameters: {
    jsCode: `${parse}\nif (!value.confirmed?.campaignId) throw new Error('Campaign could not be read');\nreturn [{json: {campaignId: value.confirmed.campaignId, seed: $('Campaign').first().json.seed}}];`,
  } },
  { id: 'export', name: 'Create reviewed export', type: '@n8n/n8n-nodes-langchain.mcpClient', typeVersion: 1.1, position: [880, 0], parameters: {
    serverTransport: 'httpStreamable', endpointUrl: 'https://app.tellseed.com/mcp', authentication: 'bearerAuth',
    tool: { __rl: true, mode: 'id', value: 'dataset_export_create' }, inputMode: 'json',
    jsonInput: '={{ { campaignId: $json.campaignId, seed: $json.seed, splitStrategy: "scenario", csv: true } }}',
    options: { timeout: 60000, convertToBinary: false },
  } },
  { id: 'summary', name: 'Export summary', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1100, 0], parameters: {
    jsCode: `${parse}\nif (!value.snapshotId || !Array.isArray(value.files)) throw new Error('Export was not created');\nreturn [{json: {snapshotId: value.snapshotId, counts: value.counts, exclusions: value.exclusions, splits: value.splits, warning: value.warning ?? null, files: value.files, next: 'Fetch files with your Tellseed credential. Reuse this snapshot ID on downstream retries; rerunning the export step creates another snapshot.'}}];`,
  } },
];
const workflow = { name: 'Tellseed: create a reviewed dataset export', active: false, nodes,
  connections: Object.fromEntries(nodes.slice(0, -1).map((node, i) => [node.name, { main: [[{ node: nodes[i + 1].name, type: 'main', index: 0 }]] }])),
  settings: { executionOrder: 'v1', saveDataSuccessExecution: 'none', saveDataErrorExecution: 'none', saveManualExecutions: false, executionTimeout: 180 }, pinData: {}, tags: [] };
const output = resolve(import.meta.dirname, 'reviewed-export.json');
await mkdir(import.meta.dirname, { recursive: true });
await writeFile(output, JSON.stringify(workflow, null, 2) + '\n');
console.log(output);
