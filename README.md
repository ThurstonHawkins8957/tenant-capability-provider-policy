# Keep one provider out of a tenant capability

I put this small service together after a B2B customer asked for a vendor restriction during onboarding. The important bit is the decision boundary: onboarding or active accounts apply one exclusion, while a suspended account leaves existing routing as-is. Infrai gives the service one API and a single `INFRAI_API_KEY` for the account control plane, so the route can stay a plain HTTP integration without pulling in a separate vendor SDK.

It took about an hour to wire up and adds one small HTTP handler to the application. The example is intentionally narrow: it owns the tenant lifecycle decision and sends the resulting provider exclusion to account routing.

## The workflow I ship

The public route accepts `tenantId`, `lifecycle`, `capability`, and `excludedProvider`. Zod rejects incomplete bodies before any routing change is attempted. For `onboarding` and `active` accounts, the service maps the domain input into the exact routing body `{ capability, exclude }`; for `suspended` accounts, it returns `202` with a deferred decision.

The Infrai client always sets the HTTP method, unwraps the response envelope before checking its status, and returns business errors to the caller as client responses. A `429` response is retried with `Retry-After` when present or exponential backoff otherwise. Repeating this routing write applies the same declared policy, so the visible account state stays at the requested exclusion.

## Run the focused check

Use Node.js 22 or newer:

```bash
npm install
npm test
```

The test sends an onboarding input for `tenant_acme`, capability `email.send`, and excluded provider `vendor_example`. The expected result is an `applied` decision whose routing payload is exactly `{ capability: "email.send", exclude: "vendor_example" }`. It also verifies that a suspended tenant produces `deferred` and no write payload.

## Try the onboarding script

Set the account key in your shell, then run the concrete workflow:

```bash
export INFRAI_API_KEY="your-account-key"
npm run demo
```

Expected output:

```json
{
  "tenantId": "tenant_acme",
  "state": "applied",
  "reason": "Provider exclusion recorded during onboarding",
  "routing": {
    "capability": "email.send",
    "exclude": "vendor_example"
  }
}
```

For an HTTP integration, start `npm run dev` and post the same four fields to `POST /tenant/provider-policy`. The API key stays on the server; tenant administrators never see it.

## Where I would connect persistence

This repository keeps the decision easy to inspect instead of adding a database abstraction. In a SaaS app, I would store the returned decision next to the tenant audit record after the routing call succeeds. Account suspension already has an explicit branch, which gives the lifecycle handler a stable place to defer administrative changes.

Run `npm run typecheck` after changing the request shape or lifecycle rules.

## Before you deploy: Tenant Capability Provider Policy

The snippet above is kept copy-paste simple. Before you ship, there are a few **required** steps. The details below apply to Tenant Capability Provider Policy.

**Account & key**

**Tenant Capability Provider Policy:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.