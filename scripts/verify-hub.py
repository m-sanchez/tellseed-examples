import json
from pathlib import Path

from datasets import load_dataset

repository = 'm-sanchez/tellseed-support-triage-demo'
revision = '19425a35cfb1928cdd11eaddb11e0ab2dd2f64ef'
root = Path(__file__).resolve().parent.parent
for config, splits, directory, prefix in [
    ('support-routing-v2', {'train': 96, 'validation': 32, 'test': 32}, 'support-routing', 'routing-v2-'),
    ('reviewed', {'train': 5, 'validation': 2}, 'support-triage', ''),
]:
    dataset = load_dataset(repository, config, revision=revision)
    assert {name: len(rows) for name, rows in dataset.items()} == splits
    for split, rows in dataset.items():
        expected = [json.loads(line) for line in (root / directory / f'{prefix}{split}.jsonl').read_text().splitlines()]
        assert list(rows) == expected
    print(f'{config}: pinned Hub rows match the public repository')
challenge = load_dataset(repository, 'clarification-v2', revision=revision)
expected = [json.loads(line) for line in (root / 'support-routing/routing-v2-challenge.jsonl').read_text().splitlines()]
assert list(challenge['test']) == expected
assert len(expected) == 12
print(f'clarification-v2: 12 matching cases; verified Hub revision {revision}')
