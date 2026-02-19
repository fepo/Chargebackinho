import { PagarmeAPI } from "@/lib/pagarme";
import type { FormContestacao } from "@/types";
import crypto from "crypto";

/**
 * POST /api/pagarme/chargebacks
 * Webhook receiver para notificações de chargebacks da Pagar.me
 * - Valida assinatura HMAC SHA-256
 * - Armazena chargeback server-side (sem localStorage)
 * - Retorna 200 SEMPRE (Pagar.me reenvia em loop se não receber 200)
 */
export async function POST(req: Request) {
  try {
    const signature = req.headers.get("x-pagar-me-signature");
    const webhookSecret = process.env.PAGARME_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("PAGARME_WEBHOOK_SECRET não configurado");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    if (!signature) {
      return new Response("Missing signature", { status: 401 });
    }

    const bodyText = await req.text();

    // Valida assinatura HMAC SHA-256
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(bodyText)
      .digest("hex");

    if (signature !== expectedSignature) {
      console.warn("Assinatura de webhook inválida");
      return new Response("Invalid signature", { status: 401 });
    }

    const payload = JSON.parse(bodyText);

    // Ignora eventos que não são de chargeback
    if (
      payload.type !== "charge.chargebacked" &&
      payload.type !== "chargeback.created"
    ) {
      return new Response(JSON.stringify({ received: true, ignored: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const chargebackData = payload.data;
    const chargeId = chargebackData.charge_id || chargebackData.id;
    const orderId = chargebackData.order_id;
    const amount = chargebackData.amount || 0;
    const reason = chargebackData.reason || "Chargeback";

    // Busca dados complementares via API (opcional)
    let orderData: any = null;
    let chargeData: any = null;

    const apiKey = process.env.PAGARME_API_KEY;
    if (apiKey) {
      try {
        const pagarme = new PagarmeAPI(apiKey);
        if (orderId) orderData = await pagarme.getOrder(orderId);
        chargeData = await pagarme.getCharge(chargeId);
      } catch (error) {
        console.error("Erro ao buscar dados da Pagar.me:", error);
      }
    }

    // Monta FormContestacao pré-preenchido (SEM localStorage — server-side)
    const rascunho: FormContestacao = {
      gateway: "pagarme",
      contestacaoId: chargebackData.id || `cb_${Date.now()}`,
      dataContestacao: new Date().toISOString().split("T")[0],
      tipoContestacao: inferirTipoContestacao(reason),
      valorTransacao: (amount / 100).toFixed(2),
      bandeira: chargeData?.payment_method?.card?.brand || "",
      finalCartao: chargeData?.payment_method?.card?.last_four_digits || "",
      dataTransacao:
        chargeData?.created_at?.split("T")[0] ||
        new Date().toISOString().split("T")[0],
      numeroPedido: orderId || chargebackData.order_id || "",
      itensPedido: orderData?.items?.map((item: any) => ({
        descricao: item.description || "Produto",
        valor: ((item.amount || 0) / 100).toFixed(2),
      })) || [{ descricao: "Pedido Pagar.me", valor: (amount / 100).toFixed(2) }],
      codigoConfirmacao: chargeId,
      nomeCliente:
        orderData?.customer?.name || chargeData?.customer?.name || "",
      cpfCliente: orderData?.customer?.documentNumber || "",
      emailCliente:
        orderData?.customer?.email || chargeData?.customer?.email || "",
      enderecoEntrega: formatarEndereco(orderData?.shippingAddress),
      enderecoFaturamento: formatarEndereco(orderData?.billingAddress),
      ipComprador: "",
      transportadora: "",
      codigoRastreio: chargeData?.metadata?.tracking_code || "",
      eventosRastreio: [],
      comunicacoes: [],
      nomeEmpresa: "",
      cnpjEmpresa: "",
      emailEmpresa: "",
      telefoneEmpresa: "",
      enderecoEmpresa: "",
      politicaReembolsoUrl: "",
    };

    const record = {
      id: rascunho.contestacaoId,
      chargeId,
      orderId,
      amount: amount / 100,
      reason,
      customerName: rascunho.nomeCliente,
      customerEmail: rascunho.emailCliente,
      createdAt: new Date().toISOString(),
      status: "opened",
      rascunho,
    };

    await saveChargebackToStore(record);

    console.log(
      `✅ Chargeback recebido: ${record.id} | R$ ${rascunho.valorTransacao} | ${rascunho.nomeCliente}`
    );

    return new Response(
      JSON.stringify({
        received: true,
        chargebackId: record.id,
        message: `Chargeback de R$ ${rascunho.valorTransacao} recebido`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro no webhook:", error);
    // Sempre 200 para não entrar em loop de reenvio
    return new Response(
      JSON.stringify({ received: true, error: "Logged internally" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * GET /api/pagarme/chargebacks
 * Retorna chargebacks recebidos via webhook
 */
export async function GET() {
  const chargebacks = await loadChargebacksFromStore();
  return new Response(JSON.stringify(chargebacks), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// ─── Store server-side ────────────────────────────────────────────────────────
// Usa memória global (warm Lambda) + /tmp (fallback entre cold starts)

const g = globalThis as any;
if (!g._cbstore) g._cbstore = [];

async function saveChargebackToStore(record: any) {
  g._cbstore = [
    record,
    ...g._cbstore.filter((c: any) => c.id !== record.id),
  ].slice(0, 100);

  try {
    const { writeFile } = await import("fs/promises");
    await writeFile("/tmp/_cbstore.json", JSON.stringify(g._cbstore));
  } catch (_) {}
}

async function loadChargebacksFromStore(): Promise<any[]> {
  if (g._cbstore.length === 0) {
    try {
      const { readFile } = await import("fs/promises");
      const raw = await readFile("/tmp/_cbstore.json", "utf-8");
      g._cbstore = JSON.parse(raw);
    } catch (_) {}
  }
  return g._cbstore;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function inferirTipoContestacao(
  reason: string
): FormContestacao["tipoContestacao"] {
  const l = (reason || "").toLowerCase();
  if (l.includes("não recebido") || l.includes("not received"))
    return "produto_nao_recebido";
  if (l.includes("fraude") || l.includes("fraud") || l.includes("unauthorized"))
    return "fraude";
  if (l.includes("crédito") || l.includes("credit") || l.includes("reembolso"))
    return "credito_nao_processado";
  return "desacordo_comercial";
}

function formatarEndereco(endereco: any): string {
  if (!endereco) return "";
  return [
    endereco.line1,
    endereco.line2,
    endereco.zipCode,
    endereco.city,
    endereco.state,
  ]
    .filter(Boolean)
    .join(", ");
}
