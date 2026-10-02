import json
import sys
from pathlib import Path

from datasets import ClassLabel, load_dataset


directory = Path(sys.argv[1] if len(sys.argv) > 1 else "converted-support-triage")
conversion = json.loads((directory / "conversion.json").read_text(encoding="utf-8"))
labels = json.loads((directory / "labels.json").read_text(encoding="utf-8"))
files = {split: str(directory / f"{split}.jsonl")
         for split, count in conversion["counts"].items() if count > 0}
if not files:
    raise ValueError("No reviewed records to load")
dataset = load_dataset("json", data_files=files)
dataset = dataset.cast_column("label", ClassLabel(names=labels))
groups = {}
for split, rows in dataset.items():
    assert len(rows) == conversion["counts"][split]
    for row in rows:
        assert labels[row["label"]] == row["label_name"]
        previous = groups.setdefault(row["lineage_group_id"], split)
        assert previous == split, "A lineage group crosses splits"
print(dataset)
print("Empty splits:", conversion["emptySplits"])
print("Synthetic demonstration only. No training or model evaluation was performed.")
