// Google Gemini 4 Argon integration for NHL GM League.
// Supports gemini-4-argon with seamless fallback to gemini-2.5-pro / gemini-2.5-flash.

export interface GeminiGenerateOptions {
  prompt: string;
  systemInstruction?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface GeminiResponse {
  text: string;
  modelUsed: string;
  model?: string;
  tokensUsed?: number;
}

const CANDIDATE_MODELS = [
  process.env.GEMINI_MODEL || "gemini-4-argon",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-flash-latest",
  "gemini-pro-latest",
];

export async function generateWithGemini(
  promptOrOpts: string | GeminiGenerateOptions,
  maybeOpts?: Partial<GeminiGenerateOptions>
): Promise<GeminiResponse> {
  const opts: GeminiGenerateOptions =
    typeof promptOrOpts === "string"
      ? { prompt: promptOrOpts, ...(maybeOpts || {}) }
      : promptOrOpts;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in environment variables.");
  }

  const modelsToTry = opts.model ? [opts.model, ...CANDIDATE_MODELS.filter((m) => m !== opts.model)] : CANDIDATE_MODELS;

  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

      const payload: Record<string, unknown> = {
        contents: [
          {
            role: "user",
            parts: [{ text: opts.prompt }],
          },
        ],
        generationConfig: {
          temperature: opts.temperature ?? 0.4,
          maxOutputTokens: opts.maxTokens ?? 2500,
        },
      };

      if (opts.systemInstruction) {
        payload.system_instruction = {
          parts: [{ text: opts.systemInstruction }],
        };
      }

      if (opts.jsonMode) {
        (payload.generationConfig as Record<string, unknown>).responseMimeType = "application/json";
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        if (res.status === 401 || (res.status === 403 && errText.includes("API_KEY_INVALID"))) {
          throw new Error(`Gemini API key error (${res.status}): ${errText}`);
        }
        console.warn(`[Gemini] Model ${model} returned ${res.status}. Falling back to next candidate...`);
        lastError = new Error(`Gemini ${model} failed (${res.status}): ${errText}`);
        continue;
      }

      const data = await res.json();
      const candidate = data.candidates?.[0];
      const part = candidate?.content?.parts?.[0];
      const text = part?.text ?? "";

      if (!text) {
        throw new Error("Empty response received from Gemini API.");
      }

      return {
        text,
        modelUsed: model,
        model,
        tokensUsed: data.usageMetadata?.totalTokenCount,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError.message.includes("API key not valid")) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error("All Gemini candidate models failed.");
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
}
