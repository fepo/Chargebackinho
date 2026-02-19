import { PagarmeAPI, getPagarmeAPI } from "@/lib/pagarme";
import { buildPrompt } from "@/lib/prompt";
import Anthropic from "@anthropic-ai/sdk";
import type { FormContestacao } from "@/types";

/**
 * POST /api/pagarme/auto-respond
 *
 * Endpoint para auto-responder chargebacks abertos (experimental)
 * - Busca chargebacks abertos via API Pagar.me
 * - Gera resposta automática via Claude
 * - Submete defesa via API
 *
 * Query params:
 * - chargebackId?: string (específico) - busca chargeback específico
 * - limit?: number (default: 5) - quantidade de chargebacks a processar
 */
export async function POST(req: Request) {
  try {
    // Parse query params
    const url = new URL(req.url);
    const chargebackId = url.searchParams.get("chargebackId");
    const limit = parseInt(url.searchParams.get("limit") || "5");

    const pagarme = getPagarmeAPI();

    // Busca chargebacks abertos
    let chargebacks;
    if (chargebackId) {
      try {
        const cb = await pagarme.getChargeback(chargebackId);
        chargebacks = [cb];
      } catch (error) {
        return new Response(
          JSON.stringify({ error: `Chargeback ${chargebackId} não encontrado` }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
    } else {
      chargebacks = await pagarme.getOpenChargebacks("opened");
    }

    if (chargebacks.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhum chargeback aberto encontrado" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Processa até `limit` chargebacks
    const results = [];
    for (const cb of chargebacks.slice(0, limit)) {
      try {
        const result = await processChargeback(cb, pagarme);
        results.push(result);
      } catch (error) {
        console.error(`Erro ao processar chargeback ${cb.id}:`, error);
        results.push({
          chargebackId: cb.id,
          status: "error",
          error: String(error),
        });
      }
    }

    return new Response(JSON.stringify({
      processedCount: results.length,
      results,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro no auto-responder:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * Processa um chargeback individual
 */
async function processChargeback(chargeback: any, pagarme: PagarmeAPI) {
  // Monta FormContestacao com dados básicos (similar ao webhook)
  const form: FormContestacao = {
    gateway: "pagarme",
    contestacaoId: chargeback.id,
    dataContestacao: new Date(chargeback.createdAt).toISOString().split("T")[0],
    tipoContestacao: "desacordo_comercial",

    valorTransacao: (chargeback.amount / 100).toFixed(2),
    bandeira: "",
    finalCartao: "",
    dataTransacao: new Date(chargeback.createdAt).toISOString().split("T")[0],

    numeroPedido: `chargeback_${chargeback.id}`,
    itensPedido: [{
      descricao: chargeback.reason || "Produto/Serviço",
      valor: (chargeback.amount / 100).toFixed(2),
    }],
    codigoConfirmacao: chargeback.id,

    nomeCliente: "",
    cpfCliente: "",
    emailCliente: "",
    enderecoEntrega: "",
    enderecoFaturamento: "",
    ipComprador: "",

    transportadora: "",
    codigoRastreio: "",
    eventosRastreio: [],

    comunicacoes: [],

    nomeEmpresa: "",
    cnpjEmpresa: "",
    emailEmpresa: "",
    telefoneEmpresa: "",
    enderecoEmpresa: "",
    politicaReembolsoUrl: "",
  };

  // Gera resposta usando Claude
  const prompt = buildPrompt(form);
  const client = new Anthropic();

  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  // Extrai resposta
  const response = message.content[0];
  if (response.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  const responseText = response.text;

  // Converte resposta para PDF (simulado - em produção usar biblioteca PDF)
  const pdfBuffer = Buffer.from(responseText, "utf-8");

  // Submete defesa
  const submitResult = await pagarme.submitChargebackDefense(
    chargeback.id,
    pdfBuffer,
    "document"
  );

  return {
    chargebackId: chargeback.id,
    status: "submitted",
    amount: chargeback.amount / 100,
    responseLength: responseText.length,
    message: submitResult.message,
    timestamp: new Date().toISOString(),
  };
}
