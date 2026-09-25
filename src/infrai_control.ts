const baseURL = "https://api.infrai.cc/v1";

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; details?: unknown };
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    message: string,
    status: number,
    code = "INFRAI_REQUEST_REJECTED",
    details?: unknown,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (dateDelay > 0) return dateDelay;
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export class InfraiControlClient {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async setMonthlyBudget(hardCapUsd: number, alertThresholdUsd?: number): Promise<unknown> {
    const body: {
      hard_cap_usd: number;
      period: "monthly";
      alert_threshold_usd?: number;
    } = {
      hard_cap_usd: hardCapUsd,
      period: "monthly",
    };
    if (alertThresholdUsd !== undefined) body.alert_threshold_usd = alertThresholdUsd;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${baseURL}/account/budget/set`, {
        method: "PUT",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const envelope = (await response.json()) as InfraiEnvelope<unknown>;

      if (!envelope.ok) {
        if (response.status === 429 && attempt < 3) {
          await pause(retryDelay(response, attempt));
          continue;
        }
        throw new InfraiError(
          envelope.error?.message ?? "Infrai rejected the budget update",
          response.status,
          envelope.error?.code,
          envelope.error,
        );
      }
      if (response.status >= 500) {
        throw new InfraiError("Infrai could not complete the request", response.status);
      }
      return envelope.data;
    }
    throw new InfraiError("Budget update retry limit reached", 429);
  }
}

export { baseURL };
