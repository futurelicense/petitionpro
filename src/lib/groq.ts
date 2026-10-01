const GROQ_BASE = "https://api.groq.com/openai/v1";

export function isGroqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

export function groqModel(): string {
  return process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-20b";
}

export function groqProseModel(): string {
  return process.env.GROQ_PROSE_MODEL?.trim() || groqModel();
}

export type GroqChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type JsonSchema = Record<string, unknown>;

export type GroqChatOptions = {
  messages: GroqChatMessage[];
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  jsonSchema?: { name: string; schema: JsonSchema };
  model?: string;
};

export class GroqError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "GroqError";
    this.status = status;
  }
}

async function groqRequest(
  apiKey: string,
  body: Record<string, unknown>
): Promise<{ ok: true; text: string | null } | { ok: false; status: number; errText: string }> {
  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return { ok: false, status: res.status, errText };
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return { ok: true, text: data.choices?.[0]?.message?.content?.trim() || null };
}

const modelCooldownUntil = new Map<string, number>();

function parseGroqWaitMs(errText: string): number | null {
  const match = errText.match(/try again in (?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?/i);
  if (!match) return null;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  const totalMs = (hours * 3600 + minutes * 60 + seconds) * 1000;
  return totalMs > 0 ? totalMs : null;
}

export async function groqChat(opts: GroqChatOptions): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new GroqError("GROQ_API_KEY is not set.", 503);
  }

  const primary = opts.model ?? groqModel();
  const allModels = [primary, "openai/gpt-oss-20b", "qwen/qwen3.8-27b"].filter(
    (m, i, arr) => arr.indexOf(m) === i
  );

  const now = Date.now();
  const available = allModels.filter((m) => {
    const cd = modelCooldownUntil.get(m);
    return !cd || cd <= now;
  });
  const models = available.length > 0 ? available : allModels;

  const baseBody: Record<string, unknown> = {
    messages: opts.messages,
    temperature: opts.temperature ?? 0.1,
    max_tokens: opts.maxTokens ?? 1600,
  };

  let lastErr = "Groq returned no usable response.";

  for (const model of models) {
    const modes: Array<"schema" | "json" | "plain"> = opts.jsonSchema
      ? ["schema", "json", "plain"]
      : opts.json
        ? ["json", "plain"]
        : ["plain"];

    for (const mode of modes) {
      const body: Record<string, unknown> = { ...baseBody, model };
      if (mode === "schema" && opts.jsonSchema) {
        body.response_format = {
          type: "json_schema",
          json_schema: {
            name: opts.jsonSchema.name,
            strict: true,
            schema: opts.jsonSchema.schema,
          },
        };
      } else if (mode === "json") {
        body.response_format = { type: "json_object" };
      }

      try {
        let result = await groqRequest(apiKey, body);

        if (!result.ok && result.status === 429) {
          const isDailyLimit = /tokens per day|requests per day|\bTPD\b|\bRPD\b/i.test(
            result.errText
          );
          const parsedWaitMs = parseGroqWaitMs(result.errText);
          const waitMs = parsedWaitMs ?? (isDailyLimit ? 300_000 : 4_000);
          const hasFallback = models.indexOf(model) < models.length - 1;
          const mins = Math.max(1, Math.round((parsedWaitMs ?? waitMs) / 60000));

          if (isDailyLimit && !hasFallback) {
            throw new GroqError(
              `Groq daily token limit reached on ${model}. Wait about ${mins} minute${mins === 1 ? "" : "s"} and try again.`,
              429
            );
          }

          if ((isDailyLimit || waitMs > 15_000) && hasFallback) {
            const cooldownMs = Math.min(Math.max(waitMs, 60_000), 1_800_000);
            modelCooldownUntil.set(model, Date.now() + cooldownMs);
            lastErr = `Groq rate-limited ${model}.`;
            break;
          }

          const retryWait = Math.min(Math.max(waitMs, 1_000), 20_000);
          await new Promise((r) => setTimeout(r, retryWait));
          result = await groqRequest(apiKey, body);
          if (!result.ok && result.status === 429) {
            throw new GroqError(
              `Groq daily token limit reached on ${model}. Wait about ${mins} minute${mins === 1 ? "" : "s"} and try again.`,
              429
            );
          }
        }

        if (result.ok && result.text) {
          modelCooldownUntil.delete(model);
          return result.text;
        }

        if (!result.ok) {
          lastErr = `Groq HTTP ${result.status}: ${result.errText.slice(0, 240)}`;
          if (
            mode === "schema" &&
            result.status === 400
          ) {
            continue;
          }
          if (
            mode === "json" &&
            result.status === 400 &&
            /json_validate_failed|Failed to validate JSON/i.test(result.errText)
          ) {
            continue;
          }
          if (result.status === 404 || result.status === 429 || result.status >= 500) {
            break;
          }
        }
      } catch (e) {
        lastErr = e instanceof Error ? e.message : "Groq request failed.";
        break;
      }
    }
  }

  throw new GroqError(lastErr, 502);
}

export function extractJsonObject<T = Record<string, unknown>>(text: string): T {
  const raw = text.trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? raw;
  const match = candidate.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new GroqError("Model did not return JSON.");
  }
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    throw new GroqError("Model JSON could not be parsed.");
  }
}

export async function groqJson<T>(opts: GroqChatOptions): Promise<T> {
  const text = await groqChat({ ...opts, json: true });
  return extractJsonObject<T>(text);
}
