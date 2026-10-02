# Create a reviewed Tellseed export from n8n

An importable workflow reads one campaign through MCP, creates a frozen reviewed-dataset export, and returns counts, exclusions, split warnings and authenticated file URLs. It runs without an AI model or a paid model API call.

**Verified with n8n 2.41.6 on 2 October 2026**, using the native MCP Client node, Streamable HTTP and a Bearer credential. The controlled test ran on a disposable GitHub runner against isolated synthetic data. Other versions and n8n Cloud have not been independently verified.

## Import and connect

1. In your existing n8n workspace, import [reviewed-export.json](reviewed-export.json). It contains no credentials, campaign data or saved executions.
2. Create an HTTP Bearer Auth credential in n8n. Paste your Tellseed workspace key into the token field, without the `Bearer ` prefix. Get it from your [workspace MCP setup](https://app.tellseed.com/home#connect).
3. Select that credential in both **Read campaign** and **Create reviewed export**. The endpoint is `https://app.tellseed.com/mcp`, the transport is Streamable HTTP, and the authentication method is Bearer Auth.
4. In **Campaign**, replace `REPLACE_WITH_YOUR_CAMPAIGN_ID` with a campaign you own. Keep the seed stable when comparing exports.
5. Review your campaign's answers in Tellseed first. Execute the workflow manually. Inspect **Export summary** for reviewed counts, excluded rows and empty splits before using the data.

The workflow does not create, approve or publish a campaign and does not change its answers. An owner key has broad workspace permissions: use only a trusted n8n workspace with appropriate member access. Scoped integration credentials are still planned. Do not put the key in node parameters, URLs, screenshots or shared workflow JSON.

## Use the result

The final item includes `snapshotId`, `counts`, `exclusions`, `splits`, `warning` and `files`. The files require authentication. If you add an HTTP Request download step, select the same Bearer credential and verify that the URL is on your Tellseed origin. Read the manifest before choosing a file: the raw CSV includes excluded and unreviewed answers, while the reviewed JSONL contains accepted targets.

Files can subsequently be withdrawn when underlying data is erased. Handle a missing or withdrawn snapshot by investigating and creating a new export only when appropriate. Do not assume a downloaded copy is erased when the source is erased; manage downstream retention yourself.

## Retries and privacy

- Reusing a frozen snapshot on a downstream retry preserves the file bytes. Running **Create reviewed export** again creates another snapshot; the workflow does not claim exactly-once execution.
- A failed request or revoked credential fails the workflow. There is no automatic retry loop or silent success fallback.
- Execution-history saving is disabled in the template, including successful, failed and manual executions. n8n still processes intermediate campaign information in memory and displays it during a manual run. Check instance logs, backups and administrator policies before using private data.
- The template uses a manual trigger and starts inactive. Add scheduling or destinations only after checking volume, credential access and downstream retention. This is not a Tellseed webhook integration.

## Recorded verification

The test imported the workflow and credential through n8n's CLI, executed it with the real MCP Client node, and repeated execution in fresh processes against the same temporary n8n database. Ten synthetic answers produced seven reviewed rows. With fixture seed `support-triage-v1`, the empty test-split warning was preserved. A second export had a new snapshot ID and matching file hashes. A simulated service outage failed, recovery succeeded, and a revoked key failed. The original ten answers were unchanged.

The runnable product integration harness stays in the private Tellseed repository. The public [builder](build.mjs) deterministically regenerates the credential-free JSON using Node 22.18+. Running it does not start n8n or any other service.

[Collection walkthrough](https://tellseed.com/guides/support-triage-dataset) · [MCP setup](https://tellseed.com/mcp) · [n8n MCP Client documentation](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-langchain.mcpclient/)
