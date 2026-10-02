import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const directory = resolve(process.argv[2] ?? import.meta.dirname);
const manifest = JSON.parse(await readFile(resolve(directory, 'routing-v2-manifest.json'), 'utf8'));
const allRows = [];
const groupSplits = new Map();
for (const [name, expected] of Object.entries(manifest.files)) {
  assert.ok(/^routing-v2-[a-z]+\.(json|jsonl)$/.test(name));
  const data = await readFile(resolve(directory, name));
  assert.equal(data.length, expected.bytes, name);
  assert.equal(createHash('sha256').update(data).digest('hex'), expected.sha256, name);
}
for (const [split, count] of [['train', 96], ['validation', 32], ['test', 32]]) {
  const rows = (await readFile(resolve(directory, `routing-v2-${split}.jsonl`), 'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(rows.length, count);
  for (const label of [0, 1, 2, 3]) assert.equal(rows.filter(row => row.label === label).length, count / 4);
  for (const row of rows) {
    assert.equal(row.split, split);
    assert.equal(row.label_name, ['billing', 'technical', 'feature', 'other'][row.label]);
    if (groupSplits.has(row.intent_group)) assert.equal(groupSplits.get(row.intent_group), split);
    groupSplits.set(row.intent_group, split);
    assert.ok(typeof row.text === 'string' && row.text.trim());
  }
  allRows.push(...rows);
}
assert.equal(new Set(allRows.map(row => row.id)).size, 160);
assert.equal(new Set(allRows.map(row => row.text.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim())).size, 160);
assert.equal(groupSplits.size, 20);
const challenge = (await readFile(resolve(directory, 'routing-v2-challenge.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
assert.equal(challenge.length, 12);
assert.equal(new Set(challenge.map(row => row.id)).size, 12);
for (const row of challenge) {
  assert.equal(row.expected_action, 'clarify');
  assert.ok(row.candidate_labels.length >= 2 && row.clarification.length > 20);
  assert.equal(row.label, undefined);
}
console.log('Verified 160 unique synthetic routing rows, 20 disjoint intent groups, balanced 96/32/32 splits, 12 clarification cases and all file hashes.');
