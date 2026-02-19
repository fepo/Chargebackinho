import { PagarmeAPI } from "@/lib/pagarme";
import type { FormContestacao } from "@/types";
import crypto from "crypto";

// ─── Blob helpers ─────────────────────────────────────────────────────────────
// Usa @vercel/blob para persistência entre serverless instances no Vercel.
// Fallback gracioso se BLOB_READ_WRITE_TOKEN não estiver configurado.

const BLOB_KEY = "chargebacks-store.json";

async function readStore(): Promise<any[]> {
  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: BLOB_KEY });
    if (!blobs.length) return [];
    const res = await fetch(blobs[0].url);
    return await res.json();
  } catch {
    // Fallback: memória global
    const g = globalThis as any;
    return g._cbstore ?? [];
  }
}

async function writeStore(data: any[]) {
  try {
    const { put } = await import("@vercel/blob");
    await put(BLOB_KEY, JSON.stringify(data), {
      access: "public",
      contentType: "application/json",
      allowOverwrite: true,
    });
  } catch {
    // Fallback: memória global
    const g = globalThis as any;
    g._cbstore = data;
  }
}

// ─── POST /api/pagarme/chargebacks ──────────────────────────────────────────
// Recebe webhook do Pagar.me, valida assinatura e persiste o chargeback.

export async function POST(req: Request) {
  try {
    const signature = req.headers.get("x-pagar-me-signature");
    const webhookSecret = process.env.PAGARME_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return new Response("Webhook secret not configured", { status: 500 });
    }

    if (!signature) {
      return new Response("Missing signature", { status: 401 });
    }

    const bodyText = await req.text();

    // Valida HMAC SHA-256
    const expected = crypto
      .createHmac("sha256", webhookSecret)
      .update(bodyText)
      .digest("hex");

    if (signature !== expected) {
      console.warn("Assinatura de webhook inválida");
      return new Response("Invalid signature", { status: 401 });
    }

    const payload = JSON.parse(bodyText);

    // Ignora eventos que não são de chargeback (retorna 200 para não reenviar)
    if (
      payload.type !== "charge.chargebacked" &&
      payload.type !== "chargeback.created"
    ) {
      return Response.json({ received: true, ignored: true });
    }

    const d = payload.data;
    const chargeId = d.charge_id || d.id;
    const orderId = d.order_id;
    const amount = d.amount || 0;
    const reason = d.reason || "Chargeback";

    // Enriquece com dados da API (opcional — só se PAGARME_API_KEY configurado)
    let orderData: any = null;
    let chargeData: any = null;
    const apiKey = process.env.PAGARME_API_KEY;
    if (apiKey) {
      try {
        const pagarme = new PagarmeAPI(apiKey);
        if (orderId) orderData = await pagarme.getOrder(orderId);
        chargeData = await pagarme.getCharge(chargeId);
      } catch (e) {
        console.error("Erro ao enriquecer dados:", e);
      }
    }

    const rascunho: FormContestacao = {
      gateway: "pagarme",
      contestacaoId: d.id || `cb_${Date.now()}`,
      dataContestacao: new Date().toISOString().split("T")[0],
      tipoContestacao: inferirTipo(reason),
      valorTransacao: (amount / 100).toFixed(2),
      bandeira: chargeData?.payment_method?.card?.brand || "",
      finalCartao: chargeData?.payment_method?.card?.last_four_digits || "",
      dataTransacao: chargeData?.created_at?.split("T")[0] || new Date().toISOString().split("T")[0],
      numeroPedido: orderId || "",
      itensPedido: orderData?.items?.map((item: any) => ({
        descricao: item.description || "Produto",
        valor: ((item.amount || 0) / 100).toFixed(2),
      })) || [{ descricao: "Pedido", valor: (amount / 100).toFixed(2) }],
      codigoConfirmacao: chargeId,
      nomeCliente: orderData?.customer?.name || chargeData?.customer?.name || "",
      cpfCliente: orderData?.customer?.documentNumber || "",
      emailCliente: orderData?.customer?.email || chargeData?.customer?.email || "",
      enderecoEntrega: fmtEndereco(orderData?.shippingAddress),
      enderecoFaturamento: fmtEndereco(orderData?.billingAddress),
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

    // Persiste no Blob Store
    const existing = await readStore();
    const updated = [
      record,
      ...existing.filter((c: any) => c.id !== record.id),
    ].slice(0, 200);
    await writeStore(updated);

    console.log(`✅ Chargeback ${record.id} — R$ ${rascunho.valorTransacao} — ${rascunho.nomeCliente}`);

    return Response.json({
      received: true,
      chargebackId: record.id,
      message: `Chargeback de R$ ${rascunho.valorTransacao} salvo`,
    });
  } catch (error) {
    console.error("Erro no webhook:", error);
    // Sempre 200 → evita loop de reenvio do Pagar.me
    return Response.json({ received: true, error: "Logged internally" });
  }
}

// ─── GET /api/pagarme/chargebacks ────────────────────────────────────────────
// Retorna todos os chargebacks armazenados (para o Dashboard).

export async function GET() {
  const chargebacks = await readStore();
  return Response.json(chargebacks);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function inferirTipo(reason: string): FormContestacao["tipoContestacao"] {
  const l = (reason || "").toLowerCase();
  if (l.includes("não recebido") || l.includes("not received")) return "produto_nao_recebido";
  if (l.includes("fraude") || l.includes("fraud") || l.includes("unauthorized")) return "fraude";
  if (l.includes("crédito") || l.includes("credit") || l.includes("reembolso")) return "credito_nao_processado";
  return "desacordo_comercial";
}

function fmtEndereco(e: any): string {
  if (!e) return "";
  return [e.line1, e.line2, e.zipCode, e.city, e.state].filter(Boolean).join(", ");
}
