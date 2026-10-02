# Support routing v2

**160 original synthetic support requests, four balanced labels, 20 intent families and 12 separate clarification cases.** This companion dataset is designed for learning, integration checks and an initial routing experiment. It is not real customer data or an independently validated benchmark.

| Split | Rows | Per label | Intent families |
| --- | ---: | ---: | ---: |
| Train | 96 | 24 | 12 |
| Validation | 32 | 8 | 4 |
| Test | 32 | 8 | 4 |
| Clarification challenge | 12 | No forced label | Mixed or underspecified requests |

## Label the requested action

| ID | Label | Include | Boundary |
| --- | --- | --- | --- |
| 0 | `billing` | Charges, refunds, cancellation, invoices, payment arrangements | A refund after an outage is billing when reimbursement is the requested action. |
| 1 | `technical` | An existing, supported capability fails | A working feature missing a new capability belongs in feature. |
| 2 | `feature` | A new or extended product capability | A request for instructions on an existing feature belongs in other. |
| 3 | `other` | How-to questions, privacy requests, partnerships, employment enquiries and positive feedback | This is a broad illustrative queue, not a production escalation policy. |

Choose the explicit primary action, not a keyword such as “invoice” or “export”. Ask for clarification when the requested action or current feature support is unclear. Split equally important requests into separate tickets. Do not route a genuine security, privacy or urgent incident automatically using this four-label policy.

## What changed from the seven-row demo

The original `support-triage` fixture demonstrates real Tellseed creation, collection, scripted review and export on an isolated instance. Its raw answers and review provenance remain available unchanged.

This larger companion was authored directly with AI assistance on 2 October 2026. Its labels were authored alongside the messages. It did **not** pass through a live campaign, recruit people, or receive independent human annotation. Neither dataset establishes product demand or model quality.

## Split design

Intent families are assigned once to a split. For example, invoice-detail requests are validation-only and payment-arrangement requests are test-only. Paraphrases from the same authored family stay together. Each class has five families, with eight messages per family: three families in train, one in validation and one in test.

This is a small test of transfer to held-out intents, not a random sample of production traffic. All text shares the same authorship process and vocabulary. Holding out a family does not eliminate semantic overlap. The test set is public, so it is unsuitable for measuring contamination-resistant model performance.

The builder checks exact and normalized duplicate text, IDs, class counts, group separation and token-set Jaccard similarity below 0.85 for every pair. The manifest records the closest cross-split pair and file hashes. These lexical checks do not prove label accuracy or independent examples.

## Use it

```python
from datasets import load_dataset

ds = load_dataset("m-sanchez/tellseed-support-triage-demo", "support-routing-v2")
print(ds)
```

For a repeatable experiment, add `revision="<full Hub commit hash>"` after copying the desired commit from the repository history. Pin `datasets==5.0.1` to reproduce the import used by our verification workflow. Loading does not train a model.

The default configuration has train, validation and test splits. `clarification-v2` loads the separate challenge as a test split; it has `expected_action`, candidate labels and a suggested clarification, not a gold classification label. `reviewed` retains the original five train and two validation rows.

Use only `text` as input and `label` as the classification target. The ID, label name, intent group and split are metadata and would leak the target or split design if used as features. Integer labels map to the table above; the local loader casts them to Hugging Face `ClassLabel` explicitly.

With a local copy, Node 22.18+ verifies file integrity without packages, a server or Docker:

```sh
node verify.mjs .
python -m pip install datasets==5.0.1
python load_dataset.py .
```

`source.mjs` contains the original messages and group assignments. In the public examples repository, run `node support-routing/build.mjs --check` to check the checked-in artifacts against their source. No external model call is made by the builder.

## Evaluation and limitations

No trained model, baseline score, human agreement measure or performance claim is included. A four-class majority predictor would score 25% accuracy by construction on each balanced split; that is an arithmetic reference, not a measured experiment.

For an initial experiment, use validation to choose settings, freeze the setup, and evaluate test once. Report macro-F1, per-class precision/recall and the confusion matrix. Inspect the clarification challenge separately for abstention and useful follow-up behaviour. With only eight test rows per class, one mistake changes class recall by 12.5 percentage points. Do not present tiny differences as reliable improvements.

The data is English-only and mainly fictional software-support language. There is no representative sampling, demographic coverage, real spelling/noise distribution, independent annotation, multilingual coverage, or measurement of robustness to malicious inputs. Labels and the broad other category need adapting to a real business. Balanced classes differ from natural queue frequencies.

Before deploying a router, collect authorised representative examples, write a policy with the team that owns each queue, obtain independent reviews, inspect disagreements and validate on a separately collected holdout. Tellseed can support collection, review and export; this dataset does not replace that work.

## Files, provenance and licence

`routing-v2-{train,validation,test}.jsonl` contain classification rows. `routing-v2-challenge.jsonl` contains clarification cases. `routing-v2-labels.json` defines label IDs. `routing-v2-manifest.json` records provenance, split membership, checks and SHA-256 digests. Hashes establish file integrity, not real-world correctness.

All requests are fictional. No production campaign, customer answer, real contact detail or scraped support corpus was used. The original data, documentation and example tooling are dedicated under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Product source, brand assets and customer data are excluded.

[Tellseed walkthrough](https://tellseed.com/guides/support-triage-dataset) · [Public examples](https://github.com/m-sanchez/tellseed-examples) · [Create your own collection campaign](https://app.tellseed.com/start)
