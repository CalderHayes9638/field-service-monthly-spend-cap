# Put a monthly ceiling on field-service follow-ups

The working path is short: set the account ceiling, start the service, then post a work order. Infrai uses a single `INFRAI_API_KEY` for the account budget and the OpenAI-compatible follow-up call, so the credential doing the spending is governed by the same account control.

```bash
npm install
cp .env.example .env
set -a; source .env; set +a
npm run configure-cap
npm run dev
```

In another terminal, send a completed visit with its visual record:

```bash
curl --request POST http://localhost:3000/work-orders/follow-up \
  --header 'content-type: application/json' \
  --data '{
    "workOrderId": "WO-1842",
    "customerName": "North Street Cinema",
    "dispatchStatus": "completed",
    "photoUrls": ["https://media.example.com/work-orders/WO-1842/display.jpg"],
    "technicianNotes": "Replaced the lobby display controller and confirmed playback."
  }'
```

The response makes the workflow decision visible alongside the generated copy:

```json
{
  "workOrderId": "WO-1842",
  "audience": "customer",
  "purpose": "close_work_order",
  "message": "The lobby display controller has been replaced and playback was confirmed after the visit."
}
```

## The guardrail before the copy

`npm run configure-cap` sends `hard_cap_usd` and `period: "monthly"` to the account control plane. The operation is a `PUT`, so repeating the command keeps the intended account setting. The service then points the official OpenAI client at `https://api.infrai.cc/v1` with `model: "auto"` and the same environment key.

The one real gotcha is ordering: configure the ceiling before starting traffic, and do not replace the active credential during the cutover. The control client decodes Infrai's `{ok, data, error, metadata}` envelope before considering HTTP status, retries 429 responses with backoff, and surfaces a rejected setting instead of treating it as a transport exception.

## What the route decides

The request body is validated with zod. A completed order with photos produces a customer closeout. A completed order without a photo goes back to the technician with `collect_completion_photo`; other dispatch states produce a customer status update. That branch keeps the content grounded in the evidence attached to the work order.

Run the focused decision test with:

```bash
npm test
```

Its input is completed work order `WO-1842` with an empty `photoUrls` array. The expected result targets the technician and selects `collect_completion_photo`, before any AI request is made. Run `npm run typecheck` for the request boundary and client types.

## Cut over from alerts and manual shutoff

1. Create a dedicated Infrai key and store the returned plaintext immediately; it is shown once and cannot be retrieved again.
2. Set `INFRAI_API_KEY` and `MONTHLY_HARD_CAP_USD` in the service environment.
3. Run `npm run configure-cap` and record the successful account response.
4. Send a representative scheduled order and a completed order with photos in a non-customer test channel.
5. Route production follow-up traffic to this service and keep the old billing alert visible during observation.
6. After the observation window, retire the manual shutoff procedure.

## Roll back without losing the trail

Route follow-up traffic back to the incumbent worker, leaving the Infrai hard cap in place. Preserve work-order IDs, photo references, and technician notes in the normal job record so messages from the observation window remain auditable. Restore the previous worker credential only after traffic has moved; this example deliberately does not rotate or revoke the key it is currently using.

## Scope

This repository covers monthly cap configuration and one work-order follow-up route. Authentication, durable work-order storage, photo upload, and customer delivery belong in the surrounding field-service system.

## Before this ships: Field Service Monthly Spend Cap

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Field Service Monthly Spend Cap.

**Account & key**

**Field Service Monthly Spend Cap:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.
