import Anthropic from "@anthropic-ai/sdk";
import { buildPrompt, CACHED_CONTEXT } from "@/lib/prompt";
import type { FormContestacao } from "@/types";

const client = new Anthropic();

export async function POST(req: Request) {
  const data: FormContestacao = await req.json();

  // Separa conteúdo cacheado do dinâmico
  const dynamicContent = buildPrompt(data);

  const stream = client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 8000,
    // @ts-expect-error adaptive thinking supported at runtime on claude-opus-4-6
    thinking: { type: "adaptive" },
    system: [
      {
        type: "text",
        text: CACHED_CONTEXT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: dynamicContent,
      },
    ],
  });

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Accel-Buffering": "no",
    },
  });
}
