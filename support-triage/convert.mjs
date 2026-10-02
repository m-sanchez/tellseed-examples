import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const LABELS = ['billing', 'technical', 'feature', 'other'];
const FILES = new Set(['raw.jsonl', 'reviewed.jsonl', 'raw.csv']);
const sha256 = value => createHash('sha256').update(value, 'utf8').digest('hex');
const canonical = value => value === null || typeof value !== 'object' ? JSON.stringify(value)
  : Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
  : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
const jsonl = rows => rows.length ? rows.map(row => JSON.stringify(row)).join('\n') + '\n' : '';
const parse = text => text.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));

export function convert(manifest, files, labels = LABELS) {
  assert.equal(manifest.schemaVersion, 1, 'This example supports Tellseed export schema 1 only');
  assert.equal(manifest.splits.strategy, 'scenario', 'Use scenario-grouped splits for this conversion');
  assert.ok(Array.isArray(labels) && labels.length && labels.every(label => typeof label === 'string' && label.length > 0));
  assert.equal(new Set(labels).size, labels.length, 'Duplicate labels');
  const { manifestDigest, ...unsigned } = manifest;
  assert.equal(sha256(canonical(unsigned)), manifestDigest, 'Manifest digest mismatch');
  assert.ok(Array.isArray(manifest.files));
  assert.equal(new Set(manifest.files.map(file => file.name)).size, manifest.files.length, 'Duplicate manifest files');
  assert.deepEqual(Object.keys(files).sort(), manifest.files.map(file => file.name).sort(), 'Supply exactly the files listed in the manifest');
  for (const file of manifest.files) {
    assert.ok(FILES.has(file.name), 'Unsupported export filename');
    assert.equal(typeof files[file.name], 'string', 'Missing export file');
    assert.equal(sha256(files[file.name]), file.sha256, `Hash mismatch: ${file.name}`);
    assert.equal(Buffer.byteLength(files[file.name], 'utf8'), file.bytes, `Byte count mismatch: ${file.name}`);
    if (file.name.endsWith('.jsonl')) assert.equal(parse(files[file.name]).length, file.records, `Record count mismatch: ${file.name}`);
  }
  assert.ok(Object.hasOwn(files, 'raw.jsonl') && Object.hasOwn(files, 'reviewed.jsonl'), 'Raw and reviewed files are required');
  const raw = parse(files['raw.jsonl']);
  const reviewed = parse(files['reviewed.jsonl']);
  assert.equal(raw.length, manifest.counts.raw, 'Raw count mismatch');
  assert.equal(raw.length, manifest.counts.submissions, 'Submission count mismatch');
  assert.equal(reviewed.length, manifest.counts.reviewed, 'Reviewed count mismatch');
  const originals = new Map(raw.map(row => [row.recordId, row]));
  assert.equal(originals.size, raw.length, 'Duplicate raw record IDs');
  assert.equal(new Set(reviewed.map(row => row.recordId)).size, reviewed.length, 'Duplicate reviewed record IDs');
  const groupSplits = new Map();
  const rawSplits = { train: 0, dev: 0, test: 0 };
  for (const row of raw) {
    assert.ok(typeof row.lineageGroupId === 'string' && row.lineageGroupId.length > 0, 'Missing lineage group');
    assert.ok(Object.hasOwn(rawSplits, row.split), 'Unknown split');
    const previous = groupSplits.get(row.lineageGroupId);
    assert.ok(!previous || previous === row.split, 'A lineage group crosses splits');
    groupSplits.set(row.lineageGroupId, row.split);
    rawSplits[row.split]++;
  }
  assert.deepEqual(rawSplits, manifest.splits.counts, 'Raw split counts mismatch');
  assert.deepEqual(manifest.splits.leakedGroups, [], 'Manifest reports leaked groups');
  const rows = reviewed.map(row => {
    const original = originals.get(row.recordId);
    assert.ok(original, 'Reviewed record has no original');
    assert.equal(original.reviewStatus, 'finalized', 'Original record was not finalized');
    assert.equal(row.campaignId, manifest.campaignId, 'Wrong campaign');
    assert.ok(manifest.campaignVersions.some(version => version.version === row.campaignVersion && version.contentDigest === row.campaignVersionDigest), 'Unknown campaign version');
    for (const field of ['campaignId', 'campaignVersion', 'campaignVersionDigest', 'scenarioExternalKey', 'lineageGroupId', 'split']) assert.equal(row[field], original[field], `Original differs: ${field}`);
    assert.equal(row.input.context, original.context, 'Input differs from original');
    assert.equal(row.input.brief, original.brief, 'Brief differs from original');
    assert.equal(typeof row.input.context, 'string');
    assert.ok(row.input.context.trim().length > 0, 'Empty input');
    assert.equal(row.provenance.submissionId, row.recordId, 'Provenance mismatch');
    for (const field of ['contributorId', 'receivedAt', 'declaredAssistance']) assert.equal(row.provenance[field], original[field], `Provenance differs: ${field}`);
    assert.deepEqual(row.provenance.reviews, original.reviews, 'Review trace differs');
    assert.ok(row.provenance.reviews.length >= manifest.policies.review.requiredReviews, 'Too few reviews');
    assert.ok(row.provenance.reviews.every(review => review.disposition === 'ACCEPTED'), 'Review was not accepted');
    assert.ok(['submission', 'reviewer-correction'].includes(row.targetSource), 'Unknown target source');
    if (row.targetSource === 'submission') assert.deepEqual(row.target, original.response, 'Unexplained target change');
    else assert.ok(row.provenance.reviews.some(review => review.corrected), 'Missing correction evidence');
    assert.equal(row.target.kind, 'single_choice', 'Only single-choice labels are supported');
    assert.equal(row.target.other, null, 'Free-form Other values require a separate mapping');
    assert.ok(labels.includes(row.target.value), 'Unknown label');
    return { id: row.recordId, text: row.input.context, label: labels.indexOf(row.target.value), label_name: row.target.value, split: row.split, lineage_group_id: row.lineageGroupId };
  });
  const splitNames = { train: 'train', dev: 'validation', test: 'test' };
  const output = { 'dataset.jsonl': jsonl(rows), 'labels.json': JSON.stringify(labels, null, 2) + '\n' };
  const counts = {};
  for (const [source, target] of Object.entries(splitNames)) {
    const selected = rows.filter(row => row.split === source);
    output[`${target}.jsonl`] = jsonl(selected);
    counts[target] = selected.length;
  }
  output['provenance.jsonl'] = jsonl(reviewed.map(row => ({ id: row.recordId, campaignId: row.campaignId, campaignVersion: row.campaignVersion, campaignVersionDigest: row.campaignVersionDigest, scenarioExternalKey: row.scenarioExternalKey, targetSource: row.targetSource, provenance: row.provenance, sourceManifestDigest: manifestDigest })));
  output['conversion.json'] = JSON.stringify({ sourceManifestDigest: manifestDigest, sourceReviewedSha256: sha256(files['reviewed.jsonl']), labelMapping: labels, reviewedRows: rows.length, counts, emptySplits: Object.keys(counts).filter(split => counts[split] === 0), note: 'Only text and label are model inputs. IDs, split and provenance are audit metadata. Counts describe this fixture, not model quality.' }, null, 2) + '\n';
  return output;
}

async function main() {
  const [input, destination, ...extra] = process.argv.slice(2);
  assert.ok(input && destination && extra.length === 0, 'Usage: node convert.mjs <export-directory|--example> <new-output-directory>');
  const read = async name => {
    assert.ok(name === 'manifest.json' || FILES.has(name), 'Unsupported filename');
    let content;
    if (input === '--example') {
      const response = await fetch(`https://tellseed.com/resources/support-triage/${name}`, { redirect: 'error', signal: AbortSignal.timeout(30_000) });
      assert.equal(response.status, 200, `Download failed: ${name}`);
      const chunks = [];
      let bytes = 0;
      for await (const chunk of response.body) {
        bytes += chunk.length;
        assert.ok(bytes <= 10_000_000, 'This small-export example has a 10 MB per-file limit');
        chunks.push(chunk);
      }
      content = Buffer.concat(chunks).toString('utf8');
    } else {
      content = await readFile(resolve(input, name), 'utf8');
      assert.ok(Buffer.byteLength(content) <= 10_000_000, 'This small-export example has a 10 MB per-file limit');
    }
    return content;
  };
  const manifest = JSON.parse(await read('manifest.json'));
  const files = {};
  for (const file of manifest.files) files[file.name] = await read(file.name);
  const output = convert(manifest, files);
  const directory = resolve(destination);
  await mkdir(directory);
  for (const [name, content] of Object.entries(output)) await writeFile(resolve(directory, name), content, { flag: 'wx' });
  console.log(output['conversion.json'].trim());
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
