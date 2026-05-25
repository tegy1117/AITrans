import { describe, expect, test, vi } from "vitest";
import { buildProviderRequest, translateWithProvider } from "../src/shared/providers";
import type { ProviderConfig, RenderedPrompt } from "../src/shared/types";

const prompt: RenderedPrompt = {
  model: "model-a",
  parameters: {
    maxTokens: 2000,
    maxOutputTokens: 500,
    temperature: 0.3,
    topP: 0.9,
    reasoningEffort: "low"
  },
  messages: [{ role: "user", content: "Translate: Hello" }]
};

describe("provider request builders", () => {
  test("builds OpenAI-compatible chat completions payloads", () => {
    const config: ProviderConfig = {
      id: "custom",
      type: "custom-openai-compatible",
      name: "Custom",
      apiKey: "key",
      baseUrl: "https://api.example.com/v1"
    };

    const request = buildProviderRequest(config, prompt);

    expect(request.url).toBe("https://api.example.com/v1/chat/completions");
    expect(request.headers.Authorization).toBe("Bearer key");
    expect(request.body).toMatchObject({
      model: "model-a",
      messages: prompt.messages,
      temperature: 0.3,
      top_p: 0.9,
      max_completion_tokens: 500
    });
  });

  test("builds Claude messages payloads", () => {
    const request = buildProviderRequest(
      { id: "claude", type: "claude", name: "Claude", apiKey: "anthropic-key" },
      prompt
    );

    expect(request.url).toBe("https://api.anthropic.com/v1/messages");
    expect(request.headers["x-api-key"]).toBe("anthropic-key");
    expect(request.body).toMatchObject({
      model: "model-a",
      max_tokens: 500,
      temperature: 0.3,
      top_p: 0.9,
      messages: [{ role: "user", content: "Translate: Hello" }]
    });
  });

  test("extracts translated text from Gemini responses", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "안녕하세요" }] } }]
        }),
        { status: 200 }
      )
    );

    const text = await translateWithProvider(
      { id: "gemini", type: "gemini", name: "Gemini", apiKey: "gemini-key" },
      prompt,
      fetcher
    );

    expect(text).toBe("안녕하세요");
    expect(fetcher).toHaveBeenCalledOnce();
  });

  test("extracts translated text from OpenAI-compatible chat completion responses", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "번역된 문장" } }]
        }),
        { status: 200 }
      )
    );

    const text = await translateWithProvider(
      {
        id: "custom",
        type: "custom-openai-compatible",
        name: "Custom",
        apiKey: "key",
        baseUrl: "https://api.example.com/v1"
      },
      prompt,
      fetcher
    );

    expect(text).toBe("번역된 문장");
  });

  test("includes provider error details when OpenAI-compatible requests fail", async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ error: { message: "Invalid API key" } }), {
        status: 401,
        statusText: "Unauthorized"
      })
    );

    await expect(
      translateWithProvider(
        {
          id: "custom",
          type: "custom-openai-compatible",
          name: "Custom",
          apiKey: "bad-key",
          baseUrl: "https://api.example.com/v1"
        },
        prompt,
        fetcher
      )
    ).rejects.toThrow("Invalid API key");
  });

  test("rejects empty OpenAI-compatible responses with an actionable message", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ choices: [] }), { status: 200 }));

    await expect(
      translateWithProvider(
        {
          id: "custom",
          type: "custom-openai-compatible",
          name: "Custom",
          apiKey: "key",
          baseUrl: "https://api.example.com/v1"
        },
        prompt,
        fetcher
      )
    ).rejects.toThrow("OpenAI-compatible response did not include choices[0].message.content");
  });
});
