# Tellseed examples

Build a collection campaign, review its answers and export a dataset you can inspect.

[Tellseed](https://tellseed.com/) · [Worked example](https://tellseed.com/guides/support-triage-dataset) · [Hugging Face dataset](https://huggingface.co/datasets/m-sanchez/tellseed-support-triage-demo) · [MCP setup](https://tellseed.com/mcp) · [Start a free workspace](https://app.tellseed.com/start)

This repository contains public, reproducible examples for [Tellseed](https://tellseed.com/), a hosted survey and data-collection tool you can use from an AI agent or its website. The product source remains private. You bring your own audience; Tellseed does not supply participants or train models.

## Choose an example

| Example | Contents | Use it for |
| --- | --- | --- |
| [Support routing v2](support-routing/README.md) | 160 original fictional requests, four balanced labels, 96/32/32 splits and 12 clarification cases | A classification starter experiment and import checks |
| [Collection and review](support-triage/README.md) | Ten scripted answers become seven accepted rows through an isolated Tellseed instance | Reproducing the actual collection, correction and export process |
| [n8n export workflow](n8n/README.md) | Native MCP Client, Bearer credential, frozen export and counts | Automating a reviewed export without an AI model |

The larger dataset uses disjoint intent families across splits and includes a documented rubric, source text, deterministic builder, duplicate checks and file hashes. All labels are authored with AI assistance. There are no independently collected human judgements or model-performance claims.

```python
from datasets import load_dataset

ds = load_dataset("m-sanchez/tellseed-support-triage-demo", "support-routing-v2")
```

Pin a full Hub commit with `revision=` for a repeatable experiment. Use `text` and `label` only as model fields. The [dataset card](support-routing/README.md) explains the held-out intent design and limitations. Run `node support-routing/verify.mjs support-routing` to check the local files, or `node support-routing/build.mjs --check` to reproduce them from source.

## Follow the collection and review example

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
