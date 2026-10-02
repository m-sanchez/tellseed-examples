# Tellseed workflows for n8n

Connect surveys, feedback, research and training-data collection to n8n. These templates use deterministic MCP calls and signed events without an AI model call. Import them into an existing n8n instance. They contain no credentials or saved executions and start inactive.

**Verified with n8n 2.41.6 on 2 October 2026**, using native MCP Client, HTTP Bearer Auth and Crypto v2 nodes on a disposable runner with synthetic data. Other versions and n8n Cloud are unverified.

| Template | Result | Restricted key permissions |
| --- | --- | --- |
| [Create a draft](create-draft.json) | Supplied questions and a signed-in owner approval URL | `campaigns:read`, `campaigns:write`; workspace-wide |
| [Publish after approval](publish-approved.json) | Checks human approval, publishes and returns a 30-day participant link | `campaigns:read`, `campaigns:publish` |
| [Reviewed export](reviewed-export.json) | Frozen files, counts, exclusions, splits and warnings | `campaigns:read`, `exports:create`; `results:read` for downloads |
| [Signed events](webhook-events.json) | Verifies original bytes, HMAC signature and timestamp | Separate Crypto credential with the webhook signing secret |

## Connect MCP workflows

1. Sign in to [Tellseed Automations](https://app.tellseed.com/home/automations). Create an expiring key with the listed actions. Prefer single-campaign scope; new campaign creation needs workspace scope.
2. Import a template in n8n. Create an **HTTP Bearer Auth** credential containing the key, without the `Bearer ` prefix.
3. Select it in every MCP Client node. Use **Streamable HTTP**, endpoint `https://app.tellseed.com/mcp`, **Bearer Auth**.
4. Replace **Campaign input** JSON or the **Campaign** ID. Execute manually before adding another trigger or schedule.

Keys cannot approve, mint owner or approval credentials, manage billing or administer integrations. Test one with a campaign read or `GET /api/automation/key` using its Bearer header. Keep keys in credential storage, never URLs, screenshots, node parameters or shared workflow JSON.

## Create, approve and publish

The draft example supplies ten feedback questions. Replace them with your questions and stable IDs. It does not generate questions with AI. Creating the same slug again returns the existing campaign without applying new input; explicitly update it or choose a new slug for another campaign.

**Human approval handoff** returns an ID, version, digest and owner URL. Open that URL, sign in and approve the exact version. Then run **Publish after approval** with the campaign ID. An absent or invalidated approval stops publication. Editing the draft requires approval again.

The published result includes a contributor link. Repeating publication can mint another link, so reuse the returned link on downstream retries. Share it only with your intended participants; it grants answering access for 30 days.

## Receive signed events

1. Import **Signed events** and copy its production Webhook URL. Keep its response mode set to finish the last node before acknowledging.
2. Add that HTTPS URL, campaign scope and event types in Tellseed Automations.
3. Copy the one-time signing secret into a new n8n **Crypto** credential's **Hmac Secret** field. Select it in **Calculate HMAC**.
4. Publish the n8n workflow. Select **Send test event** in Tellseed and check delivery status.
5. Place downstream processing **after Verified event**. Use `event.id` as a unique destination key, such as a database upsert. Return success only after durable acceptance. Signature verification does not make arbitrary spreadsheet appends or notifications idempotent.

The template reads the original body bytes, computes HMAC-SHA256, compares signatures without early exit and checks a five-minute timestamp window. Keep every verification step. Unsigned, altered and expired events must not trigger downstream actions.

| Event | Data references |
| --- | --- |
| `answer.received` | `submissionId`, `campaignVersion` |
| `campaign.published` | `campaignVersion` |
| `export.ready` | `snapshotId` |
| `webhook.test` | Empty data object |

The envelope has `id`, `schemaVersion: 1`, `type`, `workspaceId`, `campaignId`, `occurredAt` and `data`. It excludes answer text and contact details. An answer event is one item answer, including an imported answer, not a completed questionnaire.

If needed, fetch a stored answer with `GET /api/automation/answers/{submissionId}` and a scoped `results:read` Bearer key. That authenticated result can include optional contact fields. Trial results restrictions remain enforced. Only retrieve data needed by your destination.

## Retries, exports and privacy

Delivery is at least once: eight attempts with increasing delays, a ten-second request timeout and seven days of history from the event. Use a durable queue for longer processing. A timeout can occur after acceptance; deduplicate by `event.id`. Replay preserves that ID. Disabling cancels queued work, while an in-flight request may finish. Revoking an API key does not disable independent webhook subscriptions.

Export results include snapshot ID, counts, exclusions, splits, warnings and authenticated file links. Verify download URLs belong to your Tellseed origin and use a `results:read` credential. Raw CSV includes unreviewed and excluded answers; reviewed JSONL contains accepted, finalized targets. Reuse a frozen snapshot for downstream retries. Re-running export creation makes another snapshot. Erasure can withdraw files; downstream copies need their own retention and deletion policy.

Execution-history saving is disabled for successes, failures and manual runs. n8n still processes intermediate data in memory and displays it during manual runs. Check your instance logs, backups and administrator policies.

## Verification and limits

Real n8n execution verified draft retries, approval refusal and publication after scripted approval. The export fixture produced seven reviewed rows from ten answers, preserving an empty-test-split warning and frozen file hashes. A real Webhook/Crypto receiver verified three event types and rejected invalid and expired signatures. Receiver and file-backed queue restarts, receiver/downstream outages and replay recovered. A synthetic SQLite destination with a unique event ID kept three effects despite duplicate delivery. Revoked downloads failed and original answers remained unchanged. Customers must configure their own idempotent destination.

The private product repository holds the integration harness. Public [build.mjs](build.mjs) and [build-automation.mjs](build-automation.mjs) regenerate the four credential-free templates with Node 22.18+. `node build.mjs` starts no service.

Round-completion and review-finalized events, turnkey spreadsheet destinations, Make/Zapier listings and hosted OAuth remain planned. Webhooks require public HTTPS on port 443 with IPv4 DNS; redirects and private networks are refused.

[Setup guide](https://tellseed.com/guides/automation) · [Collection walkthrough](https://tellseed.com/guides/support-triage-dataset) · [MCP](https://tellseed.com/mcp) · [n8n Crypto](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.crypto/)
