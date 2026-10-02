---
license: cc0-1.0
language:
  - en
task_categories:
  - text-classification
size_categories:
  - n<1K
tags:
  - synthetic
  - demonstration
  - tellseed
pretty_name: Tellseed synthetic support-triage example
configs:
  - config_name: reviewed
    default: true
    data_files:
      - split: train
        path: train.jsonl
      - split: validation
        path: validation.jsonl
---

# Tellseed support-triage demonstration

Ten fictional support messages, ten scripted answers and nine scripted review decisions. Seven accepted examples remain after review, including one corrected label. There are **no real customer records, recruited participants or independently collected human judgements** in this dataset.

Read the [complete walkthrough](https://tellseed.com/guides/support-triage-dataset). The same frozen example is published in the [GitHub examples repository](https://github.com/m-sanchez/tellseed-examples) and the `reviewed` configuration on [Hugging Face](https://huggingface.co/datasets/m-sanchez/tellseed-support-triage-demo). The separate `support-routing-v2` configuration adds 160 directly authored synthetic requests; it is not part of this seven-row collection fixture.

## Origin and process

Tellseed prepared the fictional messages and scripted decisions with AI assistance for an interface and export demonstration on 2 October 2026. An automated runner created a fresh in-memory SQLite store, used the real MCP transport to create and publish a draft after a scripted approval through the application route, submitted all ten items through the contributor routes, posted review forms, and exported through MCP and authenticated application routes. The instance had no listening socket and no connection to production.

All submitted answers declare full AI assistance. The export's `origin: web` records the application submission route; it does not mean a real person authored the answer. Review timestamps and pseudonymous contributor/reviewer IDs are from the isolated run. The manifest hashes verify file integrity, not human authorship, consent, expertise or correctness.

The screenshots show the real application renderer with this fixture. The review screenshot has the correction selector opened and set to Feature request before acceptance. It is not a customer screenshot.

## Task and labels

The input is one English support message. The target is its topic:

| Integer | Value | Definition |
| --- | --- | --- |
| 0 | billing | Charges, refunds, invoices or subscription payments |
| 1 | technical | An existing feature fails to work |
| 2 | feature | A capability that does not exist yet |
| 3 | other | A request outside those topics |

Mixed-topic rule: use the explicit requested action. Skip if no primary action can be identified. The rubric is an illustrative policy, not a validated annotation standard.

## Review outcomes

- SUP-01 to SUP-06: accepted as submitted.
- SUP-07: corrected from `technical` to `feature`, then accepted. The raw answer remains unchanged.
- SUP-08: ambiguous and excluded from reviewed data.
- SUP-09: invalid and excluded from reviewed data.
- SUP-10: deliberately left unreviewed and excluded from reviewed data.

The decisions are scripted demonstrations. They are not evidence of agreement between independent reviewers or a measured error rate.

## Files and reproducibility

`campaign.json` is the input for `campaign_create_draft`. `review-plan.json` contains the fictional messages and scripted answers/decisions. Keep the review plan away from actual annotators in a real study. `raw.jsonl`, `reviewed.jsonl` and `raw.csv` are unmodified Tellseed export artifacts described by `manifest.json`. The CSV contains all ten raw answers, including excluded rows.

`convert.mjs` is a standalone Node 22.18+ script with no third-party dependencies. Download it and run:

```sh
node convert.mjs --example converted-support-triage
```

It downloads this fixed public example, verifies the manifest digest, file hashes, byte counts, row counts, review provenance, allowed labels and grouping, then writes to a new directory. It refuses to overwrite an existing directory. Alternatively pass a local directory containing the manifest and every listed export file in place of `--example`. The converter only supports schema 1, scenario splits and single-choice labels using the mapping above. It has a 10 MB per-file limit. Adapt and test the mapping for another campaign; this is not a universal export converter.

`dataset.jsonl` contains seven rows with `id`, `text`, integer `label`, `label_name`, original `split` and `lineage_group_id`. `provenance.jsonl` joins back on `id` to campaign, review and source-manifest information. Only `text` and `label` are model inputs; audit identifiers must not become predictive features. The common campaign brief contains the label definitions and is retained in the original reviewed export rather than concatenated into every converted input.

Scenario-grouped assignment with seed `support-triage-v1` produces eight train and two dev rows in the **raw** export. After review there are **five train, two validation and zero test rows**. The converter renames `dev` to `validation`, preserves membership and writes an empty `test.jsonl`. No rows are copied or resampled to fill the missing test split.

Fresh isolated runs reproduce the converted classification rows and split membership. Timestamps, session-derived IDs, provenance and manifest hashes change. Re-running the converter against the same downloaded snapshot reproduces the same converted bytes.

## Optional Hugging Face Datasets import

In a separate Python environment, install `datasets==5.0.1`, download `load_dataset.py`, and run:

```sh
python load_dataset.py converted-support-triage
```

The loader maps files to explicit splits, applies `ClassLabel` and verifies counts and group separation. Empty splits are reported and are not passed to the library. This is file-format interoperability, not a native Tellseed connector, an upload to the Hub or a model-training test. See [Hugging Face loading documentation](https://huggingface.co/docs/datasets/loading).

## Uses and limitations

Use this example to understand a collection/review/export workflow, inspect provenance or test an import. Do not use seven synthetic examples to measure model quality, demonstrate real customer demand or make production routing decisions. There is no held-out test set, no recruitment, no demographic or language coverage study and no consent study because no people contributed data. Choosing scenario grouping prevents a scenario from crossing splits; it does not make the same scripted contributor independent across splits.

For a real dataset, document authorised source material, participant permissions, recruitment, compensation if any, retention, review criteria, coverage and evaluation design separately. Product access never automatically grants rights to participants' data.

## Licence and attribution

Tellseed dedicates its rights in the original synthetic example data, this card, the example converter and loader to the public domain under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). This dedication does not cover the Tellseed application source, branding, screenshots or any customer data. Mentioning Tellseed and linking to the walkthrough is appreciated but is not a condition of the data licence. No affiliation with Hugging Face or endorsement is implied.
