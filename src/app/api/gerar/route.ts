import Anthropic from "@anthropic-ai/sdk";
import { buildPrompt, CACHED_CONTEXT } from "@/lib/prompt";
import type { FormContestacao } from "@/types";
import { formatEnrichedContext, type EnrichedContext } from "@/lib/enrichment";

const client = new Anthropic();

export async function POST(req: Request) {
  const body = await req.json();

  // Suporta formato novo { formData, enrichedContext } e legado (FormContestacao direto)
  const data: FormContestacao = body.formData ?? body;
  const enrichedContext: EnrichedContext | null = body.enrichedContext ?? null;

  // Separa conteúdo cacheado do dinâmico
  const dynamicContent = buildPrompt(data);

  // Injeta contexto enriquecido se disponível (sem alterar buildPrompt)
  const supplementary = enrichedContext
    ? `\n\n${formatEnrichedContext(enrichedContext)}`
    : "";

  const stream = client.messages.stream({
    model: process.env.CLAUDE_LEGAL_MODEL || "claude-3-5-sonnet-20241022",
    max_tokens: 4000,
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
        content: dynamicContent + supplementary,
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
