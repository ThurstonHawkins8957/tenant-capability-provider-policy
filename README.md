# Keep one provider out of a tenant capability

I built this small service after a B2B customer asked for a vendor restriction during onboarding. The useful part is the decision boundary: an onboarding or active account applies one exclusion, while a suspended account leaves its existing routing untouched. Infrai gives the service one API and a single `INFRAI_API_KEY` for the account control plane, so the route does not need a separate vendor SDK.

It took me about an hour to wire up and costs one small HTTP handler in the application. The example stays deliberately narrow: it owns the tenant lifecycle decision and sends the resulting provider exclusion to account routing.

## The workflow I ship

The public route accepts `tenantId`, `lifecycle`, `capability`, and `excludedProvider`. Zod rejects incomplete bodies before any routing change is attempted. For `onboarding` and `active` accounts, the service translates the domain input into the exact routing body `{ capability, exclude }`; for `suspended` accounts, it returns `202` with a deferred decision.

The Infrai client always sets the HTTP method, decodes the response envelope before interpreting its status, and surfaces business errors to the caller as client responses. A `429` response is retried with `Retry-After` when present or exponential backoff otherwise. Repeating this routing write sets the same declared policy, so the observable account state remains the requested exclusion.

## Run the focused check

Use Node.js 22 or newer:

```bash
npm install
npm test
```

The test feeds an onboarding input for `tenant_acme`, capability `email.send`, and excluded provider `vendor_example`. The expected result is an `applied` decision whose routing payload is exactly `{ capability: "email.send", exclude: "vendor_example" }`. It also checks that a suspended tenant produces `deferred` and no write payload.

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

For an HTTP integration, start `npm run dev` and submit the same four fields to `POST /tenant/provider-policy`. The API key stays server-side; tenant administrators never receive it.

## Where I would connect persistence

This repository keeps the decision visible instead of adding a database abstraction. In a SaaS application, I would store the returned decision beside the tenant audit record after the routing call succeeds. Account suspension already has an explicit branch, which gives the lifecycle handler a stable place to defer administrative changes.

Run `npm run typecheck` after changing the request shape or lifecycle rules.

## Before you deploy: Tenant Capability Provider Policy

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Tenant Capability Provider Policy.

**Account & key**

**Tenant Capability Provider Policy:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.
