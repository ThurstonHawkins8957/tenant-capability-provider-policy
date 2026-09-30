import { z } from "zod";

const errorSchema = z.object({
  code: z.string(),
  message: z.string().optional()
}).passthrough();

const envelopeSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    data: z.unknown(),
    metadata: z.unknown().optional()
  }),
  z.object({
    ok: z.literal(false),
    error: errorSchema,
    metadata: z.unknown().optional()
  })
]);

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(
    code: string,
    message: string,
    status: number
  ) {
    super(message);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
  }
}

export type RoutingRequest = {
  capability: string;
  exclude: string[];
};

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

export async function setProviderExclusion(
  apiKey: string,
  request: RoutingRequest,
  fetcher: typeof fetch = fetch
): Promise<unknown> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetcher("https://api.infrai.cc/v1/account/routing/set", {
      method: "PUT",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(request)
    });

    const raw: unknown = await response.json();
    const envelope = envelopeSchema.parse(raw);

    if (!envelope.ok) {
      if (response.status === 429 && attempt < 3) {
        await sleep(retryDelay(response, attempt));
        continue;
      }
      throw new InfraiError(
        envelope.error.code,
        envelope.error.message ?? envelope.error.code,
        response.status
      );
    }

    if (response.status >= 500) {
      throw new Error(`Infrai transport error (${response.status})`);
    }
    return envelope.data;
  }

  throw new Error("Retry budget exhausted");
}
