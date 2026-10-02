import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const parse = `const result = $input.first().json;
const text = result.content?.find(item => item.type === 'text')?.text;
const value = result.structuredContent ?? (typeof text === 'string' ? JSON.parse(text) : text);
if (!value || value.error) throw new Error(value?.error || 'Tellseed returned no usable result');`;
const manual = () => ({ id: 'manual', name: 'Run manually', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, position: [0, 0], parameters: {} });
const code = (id, name, jsCode) => ({ id, name, type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode } });
const config = (name, fields) => ({ id: 'config', name, type: 'n8n-nodes-base.set', typeVersion: 3.4, parameters: {
  assignments: { assignments: Object.entries(fields).map(([name, value]) => ({ id: name, name, type: 'string', value })) }, options: {},
} });
const mcp = (id, name, tool, jsonInput) => ({ id, name, type: '@n8n/n8n-nodes-langchain.mcpClient', typeVersion: 1.1, parameters: {
  serverTransport: 'httpStreamable', endpointUrl: 'https://app.tellseed.com/mcp', authentication: 'bearerAuth',
  tool: { __rl: true, mode: 'id', value: tool }, inputMode: 'json', jsonInput,
  options: { timeout: 60000, convertToBinary: false },
} });
const settings = { executionOrder: 'v1', saveDataSuccessExecution: 'none', saveDataErrorExecution: 'none', saveManualExecutions: false, executionTimeout: 180 };
const workflow = (name, nodes) => ({ name, active: false, nodes: nodes.map((n, i) => ({ ...n, position: [220 * i, 0] })),
  connections: Object.fromEntries(nodes.slice(0, -1).map((n, i) => [n.name, { main: [[{ node: nodes[i + 1].name, type: 'main', index: 0 }]] }])), settings, pinData: {}, tags: [] });

const campaign = { slug: 'feedback-pilot', name: 'Your feedback', objective: 'Understand participant experience and choose useful improvements.',
  instructions: 'Answer from your own experience. You may skip any question.', brief: 'This short questionnaire helps us decide what to improve.',
  collectionPolicy: { roundSize: 10, ordering: 'sequential', allowSkip: true },
  scenarios: ['What brought you here?', 'What were you hoping to achieve?', 'What worked well for you?', 'What was difficult or confusing?',
    'What would you change first?', 'Was any information missing?', 'How did this compare with your expectations?',
    'What would make you use this again?', 'Who else could benefit from this?', 'Is there anything else you want us to know?']
    .map((context, i) => ({ externalKey: `q${i + 1}`, context, responseSpec: { kind: 'free_text', minLength: 1, maxLength: 2000, verbatim: true } })),
};
const drafts = workflow('Tellseed: create a draft for human approval', [manual(), config('Campaign input', { campaignJson: JSON.stringify(campaign) }),
  mcp('create', 'Create draft', 'campaign_create_draft', '={{ JSON.parse($json.campaignJson) }}'),
  code('check', 'Read draft ID', `${parse}\nreturn [{json: {campaignId: value.confirmed.campaignId}}];`),
  mcp('preview', 'Get owner approval URL', 'campaign_preview', '={{ { campaignId: $json.campaignId } }}'),
  code('handoff', 'Human approval handoff', `${parse}\nreturn [{json: {campaignId: value.confirmed.campaignId, approvalUrl: value.approvalUrl, version: value.previewVersion, digest: value.previewDigest, next: 'The workspace owner must open this URL, sign in and approve. Then run the separate Publish approved campaign workflow.'}}];`),
]);
const publish = workflow('Tellseed: publish an approved campaign', [manual(), config('Campaign', { campaignId: 'REPLACE_WITH_YOUR_CAMPAIGN_ID' }),
  mcp('approval', 'Check human approval', 'campaign_get_approval_state', '={{ { campaignId: $json.campaignId } }}'),
  code('gate', 'Require approval', `${parse}\nif (!value.approved) throw new Error('The current draft needs human approval in Tellseed.');\nreturn [{json: {campaignId: value.confirmed.campaignId}}];`),
  mcp('publish', 'Publish approved campaign', 'campaign_publish', '={{ { campaignId: $json.campaignId } }}'),
  code('published', 'Require published state', `${parse}\nif (value.confirmed.status !== 'PUBLISHED') throw new Error('Campaign was not published');\nreturn [{json: {campaignId: value.confirmed.campaignId}}];`),
  mcp('share', 'Get participant link', 'campaign_share_link', '={{ { campaignId: $json.campaignId, audience: "contributor", label: "n8n workflow", expiresInDays: 30 } }}'),
  code('result', 'Published result', `${parse}\nreturn [{json: {campaignId: $('Require published state').first().json.campaignId, participantUrl: value.url, expiresAt: value.expiresAt}}];`),
]);

const events = workflow('Tellseed: verify signed webhook events', [
  { id: 'webhook', name: 'Tellseed event', type: 'n8n-nodes-base.webhook', typeVersion: 2, webhookId: 'tellseed-events', parameters: {
    httpMethod: 'POST', path: 'tellseed-events', responseMode: 'lastNode', responseData: 'firstEntryJson', options: { rawBody: true },
  } },
  code('prepare', 'Read signed bytes', `const headers = $input.first().json.headers ?? {};
const match = /^t=(\\d{10}),v1=([a-f0-9]{64})$/.exec(headers['x-tellseed-signature'] ?? '');
if (!match || Math.abs(Date.now() / 1000 - Number(match[1])) > 300) throw new Error('Missing or expired Tellseed signature');
const bytes = await this.helpers.getBinaryDataBuffer(0, 'data');
if (bytes.length > 8192) throw new Error('Event is too large');
return [{json: {raw: bytes.toString('utf8'), timestamp: match[1], signature: match[2], eventId: headers['x-tellseed-event-id']}}];`),
  { id: 'hmac', name: 'Calculate HMAC', type: 'n8n-nodes-base.crypto', typeVersion: 2, parameters: {
    action: 'hmac', type: 'SHA256', binaryData: false, value: '={{ $json.timestamp + "." + $json.raw }}', dataPropertyName: 'expectedSignature', encoding: 'hex',
  } },
  code('verify', 'Verified event', `const input = $input.first().json;
const expected = String(input.expectedSignature ?? '');
const actual = String(input.signature ?? '');
let difference = expected.length ^ actual.length;
for (let i = 0; i < 64; i++) difference |= (expected.charCodeAt(i) || 0) ^ (actual.charCodeAt(i) || 0);
if (difference !== 0 || expected.length !== 64) throw new Error('Invalid Tellseed signature');
const event = JSON.parse(input.raw);
if (event.schemaVersion !== 1 || event.id !== input.eventId || !['webhook.test','answer.received','campaign.published','export.ready'].includes(event.type)) throw new Error('Unsupported event');
return [{json: {accepted: true, eventId: event.id, event}}];`),
]);
for (const [name, value] of [['create-draft', drafts], ['publish-approved', publish], ['webhook-events', events]]) {
  await writeFile(resolve(import.meta.dirname, `${name}.json`), JSON.stringify(value, null, 2) + '\n');
}
