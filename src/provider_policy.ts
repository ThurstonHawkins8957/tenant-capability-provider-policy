import { z } from "zod";

export const tenantRoutingInput = z.object({
  tenantId: z.string().min(1),
  lifecycle: z.enum(["onboarding", "active", "suspended"]),
  capability: z.string().min(1),
  excludedProvider: z.string().min(1)
});

export type TenantRoutingInput = z.infer<typeof tenantRoutingInput>;

export type ProviderPolicyDecision = {
  tenantId: string;
  state: "applied" | "deferred";
  reason: string;
  routing?: { capability: string; exclude: string[] };
};

export function decideProviderPolicy(input: TenantRoutingInput): ProviderPolicyDecision {
  if (input.lifecycle === "suspended") {
    return {
      tenantId: input.tenantId,
      state: "deferred",
      reason: "Suspended accounts keep their existing routing policy"
    };
  }

  return {
    tenantId: input.tenantId,
    state: "applied",
    reason: input.lifecycle === "onboarding"
      ? "Provider exclusion recorded during onboarding"
      : "Provider exclusion updated by an administrator",
    routing: {
      capability: input.capability,
      exclude: [input.excludedProvider]
    }
  };
}
