import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const temporary = await mkdtemp(join(tmpdir(), 'tellseed-public-example-'));
try {
  const source = resolve(root, 'support-triage');
  const output = join(temporary, 'converted');
  const run = spawnSync(process.execPath, [resolve(source, 'convert.mjs'), source, output], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const files = await readdir(output);
  assert.equal(files.length, 7);
  for (const file of files) assert.ok((await readFile(join(output, file))).equals(await readFile(join(source, file))), `Different converted bytes: ${file}`);
  const conversion = JSON.parse(await readFile(join(output, 'conversion.json'), 'utf8'));
  assert.deepEqual(conversion.counts, { train: 5, validation: 2, test: 0 });
  assert.equal(conversion.reviewedRows, 7);
  console.log('Verified seven converted files, five train rows and two validation rows. Synthetic demonstration only.');
} finally {
  await rm(temporary, { recursive: true, force: true });
}
