import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { groups, challenge } from './source.mjs';

const output = resolve(process.argv.find(value => value.startsWith('--output='))?.slice(9) ?? import.meta.dirname);
const labels = ['billing', 'technical', 'feature', 'other'];
const sha256 = value => createHash('sha256').update(value).digest('hex');
const jsonl = rows => rows.map(row => JSON.stringify(row)).join('\n') + '\n';
const normalized = text => text.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const rows = groups.flatMap(([label, intent, split, messages]) => messages.map((text, i) => ({
  id: `tsr2-${intent}-${String(i + 1).padStart(2, '0')}`, text, label: labels.indexOf(label), label_name: label, intent_group: intent, split,
})));
assert.equal(rows.length, 160);
assert.equal(new Set(rows.map(row => row.id)).size, rows.length);
assert.equal(new Set(rows.map(row => normalized(row.text))).size, rows.length);
assert.equal(new Set(groups.map(group => group[1])).size, 20);
for (const row of rows) {
  assert.ok(row.label >= 0 && row.text.length >= 30 && row.text.length <= 500);
  assert.ok(!/[\r\n\t]|https?:|@|[\u2014]/.test(row.text), row.id);
}
let maximumCrossSplitTokenJaccard = 0;
let closestCrossSplitPair;
for (let i = 0; i < rows.length; i++) {
  for (let j = i + 1; j < rows.length; j++) {
    const left = new Set(normalized(rows[i].text).split(' '));
    const right = new Set(normalized(rows[j].text).split(' '));
    const similarity = [...left].filter(token => right.has(token)).length / new Set([...left, ...right]).size;
    assert.ok(similarity < 0.85, `Near-duplicate pair: ${rows[i].id}, ${rows[j].id}`);
    if (rows[i].split !== rows[j].split && similarity > maximumCrossSplitTokenJaccard) {
      maximumCrossSplitTokenJaccard = similarity;
      closestCrossSplitPair = [rows[i].id, rows[j].id];
    }
  }
}
const files = {};
const distributions = {};
for (const [split, count] of [['train', 96], ['validation', 32], ['test', 32]]) {
  const selected = rows.filter(row => row.split === split).sort((a, b) => sha256(a.id).localeCompare(sha256(b.id)));
  assert.equal(selected.length, count);
  const counts = Object.fromEntries(labels.map(label => [label, selected.filter(row => row.label_name === label).length]));
  assert.ok(Object.values(counts).every(value => value === count / 4));
  distributions[split] = { rows: count, labels: counts, intentGroups: [...new Set(selected.map(row => row.intent_group))].sort() };
  files[`routing-v2-${split}.jsonl`] = jsonl(selected);
}
files['routing-v2-challenge.jsonl'] = jsonl(challenge.map(([text, candidate_labels, clarification], i) => ({
  id: `tsr2-clarify-${String(i + 1).padStart(2, '0')}`, text, expected_action: 'clarify', candidate_labels, clarification,
})));
files['routing-v2-labels.json'] = JSON.stringify(Object.fromEntries(labels.map((label, i) => [i, label])), null, 2) + '\n';
const manifest = {
  schema: 1, version: '2.0.0', created: '2026-10-02', license: 'CC0-1.0', language: 'en',
  origin: 'Original AI-authored fictional examples and labels. No customer data and no independent human annotation.',
  process: 'Authored directly as a companion dataset; not collected or reviewed through a live Tellseed campaign.',
  sourceSha256: sha256(await readFile(resolve(import.meta.dirname, 'source.mjs'))),
  splitPolicy: 'Fixed, disjoint intent families. Twelve train families, four validation families, four test families. Balanced classes in each split.',
  distributions, challengeRows: challenge.length,
  checks: { uniqueIds: true, uniqueNormalizedTexts: true, disjointIntentGroups: true, tokenJaccardThreshold: 0.85,
    maximumCrossSplitTokenJaccard: Number(maximumCrossSplitTokenJaccard.toFixed(6)), closestCrossSplitPair,
    limitation: 'Lexical checks do not establish semantic independence, absence of stereotypes, or label correctness.' },
  files: Object.fromEntries(Object.entries(files).map(([name, content]) => [name, { sha256: sha256(content), bytes: Buffer.byteLength(content) }])),
};
files['routing-v2-manifest.json'] = JSON.stringify(manifest, null, 2) + '\n';
await mkdir(output, { recursive: true });
for (const [name, content] of Object.entries(files)) {
  if (process.argv.includes('--check')) assert.equal(await readFile(resolve(output, name), 'utf8'), content, `Stale artifact: ${name}`);
  else await writeFile(resolve(output, name), content);
}
console.log(JSON.stringify({ rows: rows.length, challengeRows: challenge.length, distributions, checks: manifest.checks }, null, 2));
