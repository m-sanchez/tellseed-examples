import argparse
from pathlib import Path

from datasets import ClassLabel, load_dataset

parser = argparse.ArgumentParser()
parser.add_argument('directory', type=Path)
args = parser.parse_args()
labels = ['billing', 'technical', 'feature', 'other']
dataset = load_dataset('json', data_files={split: str(args.directory / f'routing-v2-{split}.jsonl') for split in ['train', 'validation', 'test']})
dataset = dataset.cast_column('label', ClassLabel(names=labels))
assert {split: len(rows) for split, rows in dataset.items()} == {'train': 96, 'validation': 32, 'test': 32}
groups = {split: set(rows['intent_group']) for split, rows in dataset.items()}
assert not (groups['train'] & groups['validation'] or groups['train'] & groups['test'] or groups['validation'] & groups['test'])
for split, rows in dataset.items():
    assert all(labels[label] == name for label, name in zip(rows['label'], rows['label_name']))
    print(f'{split}: {len(rows)} synthetic rows; {len(groups[split])} intent groups')
print('Imported successfully. Use text and label only as model fields; metadata is not a predictive feature.')
