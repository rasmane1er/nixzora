# Runbook: event streaming (Kafka on Amazon MSK)

Design: [ADR-0020](../adr/0020-event-streaming-kafka.md). Off by default; nothing here applies
until it is turned on.

## Turn it on (staging)

1. Cost check: two `kafka.t3.small` brokers plus storage, about 70 USD a month.
2. In `infra/terraform/environments/staging/staging.tfvars` add `event_streaming_enabled = true`.
3. Plan and apply (creating the cluster takes 20–30 minutes):

   ```sh
   ~/nx/tofu plan -var-file=staging.tfvars -var image_tag=<deployed sha> -out=kafka.plan
   ~/nx/tofu apply kafka.plan
   ```

   The plan adds the MSK cluster, its configuration, security group, log group and two IAM
   policies, and changes the api, worker and search task definitions (new `KAFKA_*` and
   `SEARCH_INDEX_EVENTS` variables).

4. Run the **Deploy** workflow (or wait for the next push) so the services start with the new
   task definitions.
5. Check: `curl -s https://api.staging.nixzora.com/api/v1/health | jq .jobs.stream` shows
   `"status": "up"` and a small `backlog` within a minute. The search service logs
   `Indexing products from Kafka topic nixzora.product.events`.

## Turn it off

Set `event_streaming_enabled = false`, plan, apply, deploy. Services go back to the outbox-only
behaviour (search indexing by the worker). Unstreamed rows simply stay unstreamed.

## Something is wrong

| Symptom                               | Likely cause and first action                                                                                                                            |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jobs.stream.backlog` keeps growing   | Worker cannot reach Kafka. Worker logs: `Streaming to Kafka failed`. Check the MSK cluster state and the `kafka` security group (port 9098 from `apps`). |
| `Access denied` / SASL errors in logs | IAM policy: the topic prefix must be `nixzora.` and the consumer group `nixzora-search-indexer`.                                                         |
| Product edits not searchable          | Search service logs; messages in `nixzora.product.events.dlq` carry the error header. Restarting the search service reindexes everything changed.        |
| Duplicate events seen by a consumer   | Expected after a worker restart mid-batch (at-least-once). Consumers must ignore an `event-id` they already handled.                                     |

## Look at the messages

From a task in the VPC (ECS Exec is off by default, so use a one-off task with the API image):

```sh
node -e "
const { Kafka } = require('kafkajs');
const { generateAuthToken } = require('aws-msk-iam-sasl-signer-js');
const kafka = new Kafka({ brokers: process.env.KAFKA_BROKERS.split(','), ssl: true,
  sasl: { mechanism: 'oauthbearer', oauthBearerProvider: async () =>
    ({ value: (await generateAuthToken({ region: process.env.KAFKA_REGION })).token }) } });
const c = kafka.consumer({ groupId: 'nixzora-inspect-' + Date.now() });
(async () => { await c.connect(); await c.subscribe({ topic: 'nixzora.order.events', fromBeginning: true });
  await c.run({ eachMessage: async ({ message }) => console.log(message.value.toString()) }); })();
"
```

Locally: `pnpm events:up`, set `KAFKA_BROKERS=localhost:9092` in `apps/api/.env`, start the
worker (`node dist/worker-main.js`) and place an order.
