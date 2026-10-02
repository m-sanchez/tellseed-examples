# Tellseed examples

Build a collection campaign, review its answers and export a dataset you can inspect.

[Tellseed](https://tellseed.com/) · [Worked example](https://tellseed.com/guides/support-triage-dataset) · [MCP setup](https://tellseed.com/mcp) · [Start a free workspace](https://app.tellseed.com/start)

This repository contains public, reproducible examples for [Tellseed](https://tellseed.com/), a hosted survey and data-collection tool you can use from an AI agent or its website. The product source remains private. You bring your own audience; Tellseed does not supply participants or train models.

## Start with the support-triage example

Ten fictional support messages become seven accepted classification rows after scripted review. One label is corrected; its original answer remains in the raw export. One ambiguous answer, one invalid answer and one unreviewed answer are excluded.

| Step | What you can inspect |
| --- | --- |
| Create | [Campaign input](support-triage/campaign.json), ten supplied items, four answer buttons |
| Collect | [Walkthrough](https://tellseed.com/guides/support-triage-dataset#collect), ten questions shown sequentially |
| Review | [Scripted review plan](support-triage/review-plan.json), including the correction |
| Export | [Raw answers](support-triage/raw.jsonl), [reviewed targets](support-triage/reviewed.jsonl), [manifest](support-triage/manifest.json) |
| Convert | [Standalone converter](support-triage/convert.mjs), validated hashes, labels and review provenance |
| Import | [Python loader](support-triage/load_dataset.py), explicit train and validation splits |

All inputs, answers and decisions are synthetic and AI-assisted. This is a workflow demonstration, not a human study or model-quality benchmark. Read the [dataset card](support-triage/README.md) for origin, schema and limitations.

## Run without an account

Use Node 22.18 or newer. No npm packages, server or Docker are needed:

```sh
git clone https://github.com/m-sanchez/tellseed-examples.git
cd tellseed-examples
node support-triage/convert.mjs support-triage converted-support-triage
node scripts/verify.mjs
```

The converter verifies the original manifest and files, then creates a new output directory. It refuses to overwrite an existing directory. The result has five training rows, two validation rows and no test rows. Only `text` and `label` are model inputs. Identifiers and provenance are audit metadata.

For an optional Hugging Face Datasets import, use a separate Python environment:

```sh
python -m venv .venv
# Activate .venv using your shell's normal activation command.
python -m pip install datasets==5.0.1
python support-triage/load_dataset.py converted-support-triage
```

This imports files; it does not upload data or train a model. The continuous-integration workflow runs conversion verification and the pinned Python import.

## Try a campaign with your own agent

1. [Create a workspace](https://app.tellseed.com/start) and [connect your agent](https://tellseed.com/mcp).
2. Give it `support-triage/campaign.json` and ask it to preserve the ten supplied messages and answer options.
3. Inspect the preview, approve the exact version, then ask the agent to publish.
4. Use the contributor link to answer the questions. Use a private reviewer link to accept or correct answers.
5. Ask for an export with scenario grouping, seed `support-triage-v1` and CSV included.

For real work, write your own rubric and use authorised source material. Keep the example review plan away from actual annotators. Keep workspace keys, owner links and private exports out of public repositories and workflow logs.

## Licence

The original example data, documentation and tools in this repository are dedicated under [CC0 1.0](LICENSE). Tellseed's product source, brand assets, screenshots and customer data are outside that dedication. Third-party projects retain their own licences. Linking to Tellseed is appreciated but not required. No endorsement by Hugging Face, GitHub or n8n is implied.
