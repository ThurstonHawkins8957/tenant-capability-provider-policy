import { createServer } from "node:http";
import { z } from "zod";
import { InfraiError, setProviderExclusion } from "./infrai_routing_client.js";
import { decideProviderPolicy, tenantRoutingInput } from "./provider_policy.js";

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

export const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/tenant/provider-policy") {
    send(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const input = tenantRoutingInput.parse(await readJson(request));
    const decision = decideProviderPolicy(input);

    if (decision.state === "deferred") {
      send(response, 202, decision);
      return;
    }

    const apiKey = process.env.INFRAI_API_KEY;
    if (!apiKey) {
      send(response, 503, { error: "INFRAI_API_KEY is required" });
      return;
    }

    await setProviderExclusion(apiKey, decision.routing!);
    send(response, 200, decision);
  } catch (error) {
    if (error instanceof InfraiError) {
      send(response, error.status >= 400 && error.status < 500 ? error.status : 502, {
        error: error.code,
        message: error.message
      });
      return;
    }
    if (error instanceof SyntaxError) {
      send(response, 400, { error: "Request body must be valid JSON" });
      return;
    }
    if (error instanceof z.ZodError) {
      send(response, 400, { error: "Invalid request", details: error.issues });
      return;
    }
    send(response, 500, { error: "Request could not be processed" });
  }
});

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3000);
  server.listen(port, () => console.log(`Tenant routing service listening on ${port}`));
}
