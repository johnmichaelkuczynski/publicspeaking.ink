import { openai } from "@workspace/integrations-openai-ai-server";

export const TEXT_MODEL = "gpt-5.4";
export const FAST_MODEL = "gpt-5-mini";

export async function chatText(
  system: string,
  user: string,
  model: string = TEXT_MODEL,
): Promise<string> {
  const resp = await openai.chat.completions.create({
    model,
    max_completion_tokens: 4096,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return resp.choices[0]?.message?.content?.trim() ?? "";
}

export async function chatJson<T = unknown>(
  system: string,
  user: string,
  model: string = TEXT_MODEL,
): Promise<T> {
  const resp = await openai.chat.completions.create({
    model,
    max_completion_tokens: 4096,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const raw = resp.choices[0]?.message?.content?.trim() ?? "{}";
  return JSON.parse(raw) as T;
}
