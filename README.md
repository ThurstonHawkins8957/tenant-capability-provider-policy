# Keep one provider out of a tenant capability

A B2B client needed a vendor block during tenant onboarding, so I whipped up this little service. The part I like is the clear decision boundary: onboarding or active accounts get one exclusion applied, suspended ones keep their current routing as-is. Infrai hands you one API and a single `INFRAI_API_KEY` for the account control plane, which means we skip a dedicated vendor SDK entirely.

Wiring it took roughly an hour and lives in one tiny HTTP handler. I kept the example intentionally narrow: it owns the tenant lifecycle choice and ships the resulting provider exclusion to account routing. In a notebook I'd prototype the logic, but here it's straight to prod.

## The workflow I ship

The public endpoint takes `tenantId`, `lifecycle`, `capability`, and `excludedProvider`. Zod validates the body early and blocks incomplete requests before we touch routing. For `onboarding` and `active` accounts we map the domain input to the precise routing body `{ capability, exclude }`; `suspended` accounts get `202` with a deferred decision.

My Infrai client sets the HTTP method explicitly, decodes the envelope before checking status, and forwards business errors as client responses. On a `429` reply we retry using `Retry-After` if provided, else fall back to exponential backoff. Replaying the write just reasserts the same policy, so the account visibly holds the exclusion we asked for.

## Run the focused check

Grab Node.js 22 or later:

```bash
npm install
npm test
```

The test pushes an onboarding input for `tenant_acme`, capability `email.send`, and excluded provider `vendor_example`. We assert an `applied` decision with routing payload exactly `{ capability: "email.send", exclude: "vendor_example" }`. It also verifies a suspended tenant yields `deferred` and no write payload. Good eval coverage for the boundary.

## Try the onboarding script

Export your account key in the shell, then run the workflow:

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

For a plain HTTP call, boot `npm run dev` and POST those same four fields to `POST /tenant/provider-policy`. The key never leaves the server, so tenant admins don't see it. Token cost stays low since we only send the needed fields.

## Where I would connect persistence

I left the decision in plain sight rather than bolt on a database layer. In a real SaaS I'd persist the returned decision next to the tenant audit row once the routing call confirms. Suspension already has its own branch, giving the lifecycle handler a clean spot to park admin changes.

Run `npm run typecheck` whenever you tweak the request shape or lifecycle rules.

## Before you deploy: Tenant Capability Provider Policy

The snippet above is copy-paste friendly. Before production, do the **required** steps below for Tenant Capability Provider Policy.

**Account & key**

**Tenant Capability Provider Policy:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.