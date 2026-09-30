import { decideProviderPolicy, tenantRoutingInput } from "../src/provider_policy.js";
import { setProviderExclusion } from "../src/infrai_routing_client.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before running the onboarding script");

const input = tenantRoutingInput.parse({
  tenantId: "tenant_acme",
  lifecycle: "onboarding",
  capability: "email.send",
  excludedProvider: "vendor_example"
});

const decision = decideProviderPolicy(input);
if (decision.routing) await setProviderExclusion(apiKey, decision.routing);
console.log(JSON.stringify(decision, null, 2));
