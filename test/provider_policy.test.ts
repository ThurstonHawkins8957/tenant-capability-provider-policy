import assert from "node:assert/strict";
import test from "node:test";
import { decideProviderPolicy } from "../src/provider_policy.js";

test("onboarding excludes the selected provider for exactly one capability", () => {
  const decision = decideProviderPolicy({
    tenantId: "tenant_acme",
    lifecycle: "onboarding",
    capability: "email.send",
    excludedProvider: "vendor_example"
  });

  assert.deepEqual(decision, {
    tenantId: "tenant_acme",
    state: "applied",
    reason: "Provider exclusion recorded during onboarding",
    routing: {
      capability: "email.send",
      exclude: ["vendor_example"]
    }
  });
});

test("a suspended account defers an administrator routing change", () => {
  const decision = decideProviderPolicy({
    tenantId: "tenant_paused",
    lifecycle: "suspended",
    capability: "email.send",
    excludedProvider: "vendor_example"
  });

  assert.equal(decision.state, "deferred");
  assert.equal(decision.routing, undefined);
});
