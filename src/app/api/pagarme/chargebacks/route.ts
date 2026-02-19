import { PagarmeAPI } from "@/lib/pagarme";
import { salvarRascunho } from "@/lib/storage";
import type { FormContestacao } from "@/types";
import crypto from "crypto";

/**
 * POST /api/pagarme/chargebacks
 *
 * Webhook receiver para notificações de chargebacks da Pagar.me
 * - Valida assinatura
 * - Cria rascunho auto-preenchido
 * - Notifica usuário
 */
export async function POST(req: Request) {
  try {
    // Lê signature do header
    const signature = req.headers.get("x-pagar-me-signature");
    const webhookSecret = process.env.PAGARME_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("PAGARME_WEBHOOK_SECRET não configurado");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    if (!signature) {
      return new Response("Missing signature", { status: 401 });
    }

    // Lê body como string para validação
    const bodyText = await req.text();

    // Valida assinatura
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(bodyText)
      .digest("hex");

    if (signature !== expectedSignature) {
      console.warn("Assinatura de webhook inválida");
      return new Response("Invalid signature", { status: 401 });
    }

    // Faz parse do payload
    const payload = JSON.parse(bodyText);

    // Verifica se é evento de chargeback
    if (payload.type !== "charge.chargebacked" && payload.type !== "chargeback.created") {
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
      });
    }

    // Extrai dados do chargeback
    const chargebackData = payload.data;
    const chargeId = chargebackData.charge_id || chargebackData.id;
    const orderId = chargebackData.order_id;
    const amount = chargebackData.amount || 0;
    const reason = chargebackData.reason || "Chargeback";

    // Busca dados do pedido via API
    let orderData: any = null;
    let chargeData: any = null;

    try {
      const pagarme = new PagarmeAPI(process.env.PAGARME_API_KEY || "");

      if (orderId) {
        orderData = await pagarme.getOrder(orderId);
      }

      chargeData = await pagarme.getCharge(chargeId);
    } catch (error) {
      console.error("Erro ao buscar dados da Pagar.me:", error);
      // Continua mesmo se falhar
    }

    // Monta rascunho auto-preenchido
    const rascunho: FormContestacao = {
      gateway: "pagarme",
      contestacaoId: chargebackData.id || `cb_${Date.now()}`,
      dataContestacao: new Date().toISOString().split("T")[0],
      tipoContestacao: inferirTipoContestacao(reason),

      // Dados da transação
      valorTransacao: (amount / 100).toFixed(2),
      bandeira: chargeData?.payment_method?.card?.brand || "",
      finalCartao: chargeData?.payment_method?.card?.last_four_digits || "",
      dataTransacao: chargeData?.created_at?.split("T")[0] || "",

      // Dados do pedido
      numeroPedido: orderId || chargebackData.order_id || "",
      itensPedido: orderData?.items?.map((item: any) => ({
        descricao: item.description || "Produto",
        valor: ((item.amount || 0) / 100).toFixed(2),
      })) || [{ descricao: "Pedido Pagar.me", valor: (amount / 100).toFixed(2) }],
      codigoConfirmacao: chargeId,

      // Dados do cliente
      nomeCliente: orderData?.customer?.name || chargeData?.customer?.name || "",
      cpfCliente: orderData?.customer?.document || "",
      emailCliente: orderData?.customer?.email || chargeData?.customer?.email || "",
      enderecoEntrega: formatarEndereco(orderData?.shipping_address) || "",
      enderecoFaturamento: formatarEndereco(orderData?.billing_address) || "",
      ipComprador: chargeData?.customer?.ip || "",

      // Dados de entrega
      transportadora: "",
      codigoRastreio: chargeData?.metadata?.tracking_code || "",
      eventosRastreio: [],

      // Comunicações
      comunicacoes: [],

      // Dados da empresa (para ser preenchido pelo usuário)
      nomeEmpresa: "",
      cnpjEmpresa: "",
      emailEmpresa: "",
      telefoneEmpresa: "",
      enderecoEmpresa: "",
      politicaReembolsoUrl: "",
    };

    // Salva rascunho
    const savedRascunho = salvarRascunho(rascunho, false);

    // TODO: Notificar usuário (via email, Slack, etc)
    console.log(`Rascunho criado para chargeback ${rascunho.contestacaoId}:`, savedRascunho);

    return new Response(JSON.stringify({
      received: true,
      chargebackId: rascunho.contestacaoId,
      rascunhoId: savedRascunho.id,
      message: `Chargeback de R$ ${rascunho.valorTransacao} no pedido #${rascunho.numeroPedido} aguardando sua defesa`,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro no webhook de chargebacks:", error);
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
 * Infere tipo de contestação baseado na razão
 */
function inferirTipoContestacao(reason: string): FormContestacao["tipoContestacao"] {
  const lower = (reason || "").toLowerCase();

  if (lower.includes("não recebido") || lower.includes("not received") || lower.includes("nao enviado")) {
    return "produto_nao_recebido";
  }
  if (lower.includes("fraude") || lower.includes("fraud") || lower.includes("unauthorized")) {
    return "fraude";
  }
  if (lower.includes("crédito") || lower.includes("credit") || lower.includes("reembolso") || lower.includes("refund")) {
    return "credito_nao_processado";
  }

  // Default: desacordo comercial
  return "desacordo_comercial";
}

/**
 * Formata endereço para string única
 */
function formatarEndereco(endereco: any): string {
  if (!endereco) return "";

  const parts = [
    endereco.line1,
    endereco.line2,
    endereco.zipCode,
    endereco.city,
    endereco.state,
    endereco.country,
  ];

  return parts.filter(Boolean).join(", ");
}
