/**
 * Serviço de enriquecimento de dados para contestação de chargeback.
 *
 * Coleta dados adicionais de APIs já integradas (Shopify, Pagar.me)
 * e computa análises (timeline, Art. 49, match de endereços) para
 * alimentar a IA com mais contexto ao gerar o PDF de contestação.
 */

import type { ShopifyOrder } from "@/lib/shopify";
import type { EventoRastreio } from "@/types";
import { mapReasonCode, type ReasonCodeInfo } from "@/lib/reasonCodes";

/* ══════════════════════════════════════════════════════════════════════════
   Interfaces
═══════════════════════════════════════════════════════════════════════════ */

export interface CustomerHistory {
  totalOrders: number;
  totalSpent: number;
  firstOrderDate: string | null;
  undisputedOrders: number;
  repeatBuyer: boolean;
  orders: Array<{
    name: string;
    date: string;
    amount: string;
    fulfillmentStatus: string | null;
  }>;
}

export interface TransactionAuth {
  threeDSecureStatus: string | null;
  cvvResult: string | null;
  avsResult: string | null;
  authorizationCode: string | null;
  nsu: string | null;
  antifraudScore: string | null;
  antifraudStatus: string | null;
  cardBrand: string | null;
  cardLastFour: string | null;
}

export interface TimelineEvent {
  date: string;
  event: string;
  source: "pagarme" | "shopify" | "tracking" | "computed";
  detail?: string;
}

export interface Art49Analysis {
  deliveryDate: string | null;
  chargebackDate: string;
  daysAfterDelivery: number | null;
  withinWithdrawalWindow: boolean;
  analysis: string;
}

export interface AddressAnalysis {
  billingAddress: string | null;
  shippingAddress: string | null;
  match: boolean;
  similarityScore: number;
  details: string;
}

export interface RefundInfo {
  processed: boolean;
  amount: number; // em centavos
  date: string | null;
  source: "shopify" | "pagarme";
}

export interface EnrichedContext {
  customerHistory: CustomerHistory | null;
  transactionAuth: TransactionAuth | null;
  timeline: TimelineEvent[];
  art49: Art49Analysis | null;
  addressAnalysis: AddressAnalysis | null;
  reasonCode: ReasonCodeInfo | null;
  overallStrength: "strong" | "moderate" | "weak";
  strengthReasons: string[];
  termsAccepted: boolean | null;   // aceite de termos no checkout (Shopify customAttributes)
  refundInfo: RefundInfo | null;   // estorno já processado (Shopify refunds / Pagar.me status)
  refundPolicyUrl: string | null;  // URL da política de reembolso (Shopify shop policy)
}

/* ══════════════════════════════════════════════════════════════════════════
   Inputs
═══════════════════════════════════════════════════════════════════════════ */

export interface EnrichmentInput {
  customerEmail: string;
  amount: number;
  reason: string;
  chargebackDate: string; // ISO date
  pagarmeCharge?: any; // raw Pagar.me charge response
  shopifyOrder?: ShopifyOrder | null;
  allShopifyOrders?: ShopifyOrder[];
  trackingEvents?: EventoRastreio[];
  billingAddress?: string | null;
  shippingAddress?: string | null;
  shopRefundPolicyUrl?: string | null;
}

/* ══════════════════════════════════════════════════════════════════════════
   Builders
═══════════════════════════════════════════════════════════════════════════ */

function buildCustomerHistory(
  allOrders: ShopifyOrder[],
): CustomerHistory | null {
  if (!allOrders.length) return null;

  const sorted = [...allOrders].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const totalSpent = allOrders.reduce(
    (sum, o) => sum + parseFloat(o.totalPrice || "0"),
    0
  );

  return {
    totalOrders: allOrders.length,
    totalSpent,
    firstOrderDate: sorted[0]?.createdAt ?? null,
    undisputedOrders: allOrders.length, // Sem dados de disputa cross-ref por enquanto
    repeatBuyer: allOrders.length > 1,
    orders: sorted.map((o) => ({
      name: o.name,
      date: o.createdAt,
      amount: o.totalPrice,
      fulfillmentStatus: o.fulfillmentStatus,
    })),
  };
}

function extractTransactionAuth(charge: any): TransactionAuth | null {
  if (!charge) return null;

  const tx = charge.last_transaction ?? {};
  const antifraud = tx.antifraud_response ?? charge.antifraud_response ?? {};
  const card = tx.card ?? charge.card ?? {};
  const gateway = tx.gateway_response ?? {};

  return {
    threeDSecureStatus: tx.threed_secure?.status ?? tx.three_d_secure_status ?? null,
    cvvResult: tx.cvv_result ?? gateway.cvv_result ?? null,
    avsResult: tx.avs_result ?? gateway.avs_result ?? null,
    authorizationCode: tx.authorization_code ?? gateway.authorization_code ?? tx.acquirer_auth_code ?? null,
    nsu: tx.nsu ?? tx.acquirer_nsu ?? gateway.nsu ?? null,
    antifraudScore: antifraud.score?.toString() ?? null,
    antifraudStatus: antifraud.status ?? null,
    cardBrand: card.brand ?? null,
    cardLastFour: card.last_four_digits ?? card.last_digits ?? null,
  };
}

function buildTimeline(input: EnrichmentInput): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Pedido Shopify criado
  if (input.shopifyOrder?.createdAt) {
    events.push({
      date: input.shopifyOrder.createdAt,
      event: `Pedido criado (${input.shopifyOrder.name})`,
      source: "shopify",
    });
  }

  // Pagamento autorizado (Pagar.me)
  if (input.pagarmeCharge?.created_at) {
    events.push({
      date: input.pagarmeCharge.created_at,
      event: "Pagamento autorizado",
      source: "pagarme",
      detail: input.pagarmeCharge.payment_method ?? undefined,
    });
  }

  // Fulfillments Shopify
  if (input.shopifyOrder?.fulfillments) {
    for (const f of input.shopifyOrder.fulfillments) {
      if (f.createdAt) {
        events.push({
          date: f.createdAt,
          event: `Fulfillment criado (${f.status})`,
          source: "shopify",
          detail: f.trackingInfo?.number ?? undefined,
        });
      }
    }
  }

  // Eventos de rastreamento
  if (input.trackingEvents?.length) {
    for (const e of input.trackingEvents) {
      events.push({
        date: e.data,
        event: e.descricao,
        source: "tracking",
      });
    }
  }

  // Chargeback aberto
  if (input.chargebackDate) {
    events.push({
      date: input.chargebackDate,
      event: "Chargeback aberto",
      source: "pagarme",
    });
  }

  // Ordena cronologicamente
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calcula gap entre entrega e chargeback
  const deliveryEvent = events.find((e) =>
    /entreg|delivered|destinat/i.test(e.event)
  );
  if (deliveryEvent && input.chargebackDate) {
    const daysGap = Math.round(
      (new Date(input.chargebackDate).getTime() - new Date(deliveryEvent.date).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    if (daysGap > 0) {
      events.push({
        date: input.chargebackDate,
        event: `${daysGap} dias entre entrega e abertura do chargeback`,
        source: "computed",
      });
    }
  }

  return events;
}

function analyzeArt49(
  trackingEvents: EventoRastreio[] | undefined,
  chargebackDate: string,
  shopifyOrder?: ShopifyOrder | null,
): Art49Analysis | null {
  if (!chargebackDate) return null;

  // Tenta encontrar data de entrega nos eventos de rastreio
  let deliveryDate: string | null = null;

  if (trackingEvents?.length) {
    const deliveryEvent = trackingEvents.find((e) =>
      /entreg|delivered|destinat/i.test(e.descricao)
    );
    if (deliveryEvent) {
      deliveryDate = deliveryEvent.data;
    }
  }

  // Fallback: fulfillment delivered do Shopify
  if (!deliveryDate && shopifyOrder?.fulfillments) {
    const delivered = shopifyOrder.fulfillments.find(
      (f) => f.status === "delivered"
    );
    if (delivered?.updatedAt) {
      deliveryDate = delivered.updatedAt;
    }
  }

  if (!deliveryDate) {
    return {
      deliveryDate: null,
      chargebackDate,
      daysAfterDelivery: null,
      withinWithdrawalWindow: false,
      analysis: "Não foi possível determinar a data de entrega para análise do Art. 49 CDC.",
    };
  }

  const deliveryMs = new Date(deliveryDate).getTime();
  const cbMs = new Date(chargebackDate).getTime();
  const days = Math.round((cbMs - deliveryMs) / (1000 * 60 * 60 * 24));

  const within7 = days <= 7;
  const deadlineDate = new Date(deliveryMs + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  let analysis: string;
  if (days < 0) {
    analysis = "O chargeback foi aberto ANTES da entrega. O produto pode não ter sido recebido.";
  } else if (within7) {
    analysis = `O chargeback foi aberto ${days} dia(s) após a entrega — DENTRO do prazo de arrependimento de 7 dias (Art. 49 CDC).`;
  } else {
    analysis = `O chargeback foi aberto ${days} dias após a entrega — FORA do prazo de arrependimento (expirou em ${deadlineDate}). O consumidor não exerceu o direito de arrependimento no prazo legal.`;
  }

  return {
    deliveryDate,
    chargebackDate,
    daysAfterDelivery: days,
    withinWithdrawalWindow: within7,
    analysis,
  };
}

function analyzeAddress(
  billing: string | null | undefined,
  shipping: string | null | undefined,
): AddressAnalysis | null {
  if (!billing && !shipping) return null;

  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const b = billing ? normalize(billing) : "";
  const s = shipping ? normalize(shipping) : "";

  if (!b || !s) {
    return {
      billingAddress: billing ?? null,
      shippingAddress: shipping ?? null,
      match: false,
      similarityScore: 0,
      details: !b
        ? "Endereço de faturamento não disponível."
        : "Endereço de entrega não disponível.",
    };
  }

  // Calcula similaridade simples (palavras em comum)
  const bWords = new Set(b.split(" "));
  const sWords = new Set(s.split(" "));
  const common = [...bWords].filter((w) => sWords.has(w) && w.length > 2).length;
  const total = Math.max(bWords.size, sWords.size);
  const score = total > 0 ? Math.round((common / total) * 100) : 0;

  const match = score >= 70;

  let details: string;
  if (score >= 90) {
    details = "Endereços de faturamento e entrega são praticamente idênticos — forte indício de legitimidade.";
  } else if (score >= 70) {
    details = "Endereços de faturamento e entrega têm alta similaridade — compatíveis.";
  } else if (score >= 40) {
    details = "Endereços de faturamento e entrega diferem parcialmente — pode indicar presente ou endereço comercial.";
  } else {
    details = "Endereços de faturamento e entrega são significativamente diferentes.";
  }

  return {
    billingAddress: billing ?? null,
    shippingAddress: shipping ?? null,
    match,
    similarityScore: score,
    details,
  };
}

/**
 * Verifica aceite de termos no checkout do Shopify.
 * Busca em customAttributes por chaves relacionadas a termos, LGPD, aceite.
 * Retorna true se encontrado, false se explicitamente ausente, null se dados insuficientes.
 */
function extractTermsAccepted(shopifyOrder?: ShopifyOrder | null): boolean | null {
  if (!shopifyOrder) return null;

  const TERM_KEYS = /terms|aceite|lgpd|privacidade|consent|accept|agree/i;

  // Verifica customAttributes
  if (shopifyOrder.customAttributes?.length) {
    const found = shopifyOrder.customAttributes.some(
      (attr) => TERM_KEYS.test(attr.key) || TERM_KEYS.test(attr.value)
    );
    if (found) return true;
    // Se há customAttributes mas nenhum é de termos, retorna false (checkout sem aceite registrado)
    return false;
  }

  // Verifica nota do pedido
  if (shopifyOrder.note && TERM_KEYS.test(shopifyOrder.note)) {
    return true;
  }

  // Sem customAttributes nem nota — não há como saber
  return null;
}

/**
 * Extrai informações de estorno do pedido Shopify e do charge Pagar.me.
 */
function extractRefundInfo(
  shopifyOrder?: ShopifyOrder | null,
  pagarmeCharge?: any,
): RefundInfo | null {
  // Shopify: verifica refunds do pedido
  if (shopifyOrder?.refunds?.length) {
    const refund = shopifyOrder.refunds[0];
    return {
      processed: true,
      amount: refund.totalAmount,
      date: refund.createdAt,
      source: "shopify",
    };
  }

  // Pagar.me: status refunded no charge
  if (pagarmeCharge?.status === "refunded") {
    const amount = pagarmeCharge.amount ?? 0;
    return {
      processed: true,
      amount,
      date: pagarmeCharge.updated_at ?? pagarmeCharge.created_at ?? null,
      source: "pagarme",
    };
  }

  return null;
}

function computeStrength(ctx: Omit<EnrichedContext, "overallStrength" | "strengthReasons">): {
  overallStrength: EnrichedContext["overallStrength"];
  strengthReasons: string[];
} {
  const reasons: string[] = [];
  let score = 0;

  // Timeline com entrega comprovada
  const hasDelivery = ctx.timeline.some((e) =>
    /entreg|delivered|destinat/i.test(e.event)
  );
  if (hasDelivery) {
    score += 3;
    reasons.push("Entrega comprovada com rastreio");
  }

  // Cliente recorrente
  if (ctx.customerHistory?.repeatBuyer) {
    score += 2;
    reasons.push(
      `Cliente recorrente (${ctx.customerHistory.totalOrders} pedidos, R$ ${ctx.customerHistory.totalSpent.toFixed(2)} total)`
    );
  }

  // Art. 49 expirado
  if (ctx.art49 && !ctx.art49.withinWithdrawalWindow && ctx.art49.daysAfterDelivery !== null && ctx.art49.daysAfterDelivery > 7) {
    score += 2;
    reasons.push(`Prazo Art. 49 CDC expirado (${ctx.art49.daysAfterDelivery} dias após entrega)`);
  }

  // Endereços compatíveis
  if (ctx.addressAnalysis?.match) {
    score += 1;
    reasons.push("Endereços de faturamento e entrega compatíveis");
  }

  // 3D Secure autenticado
  if (ctx.transactionAuth?.threeDSecureStatus &&
    /authenticat|autenticad/i.test(ctx.transactionAuth.threeDSecureStatus)) {
    score += 2;
    reasons.push("Transação autenticada via 3D Secure");
  }

  // CVV compatível
  if (ctx.transactionAuth?.cvvResult &&
    /match|compat|M/i.test(ctx.transactionAuth.cvvResult)) {
    score += 1;
    reasons.push("CVV compatível");
  }

  // Antifraude aprovado
  if (ctx.transactionAuth?.antifraudStatus &&
    /approv|pass/i.test(ctx.transactionAuth.antifraudStatus)) {
    score += 1;
    reasons.push("Análise antifraude aprovada");
  }

  // Reason code com win rate alto
  if (ctx.reasonCode?.winRateHint === "high") {
    score += 1;
    reasons.push("Tipo de disputa com alta taxa de sucesso");
  }

  // Aceite de termos confirmado
  if (ctx.termsAccepted === true) {
    score += 1;
    reasons.push("Aceite dos termos registrado no checkout");
  }

  const overallStrength: EnrichedContext["overallStrength"] =
    score >= 6 ? "strong" : score >= 3 ? "moderate" : "weak";

  return { overallStrength, strengthReasons: reasons };
}

/* ══════════════════════════════════════════════════════════════════════════
   Main builder
═══════════════════════════════════════════════════════════════════════════ */

export function buildEnrichedContext(input: EnrichmentInput): EnrichedContext {
  const customerHistory = input.allShopifyOrders
    ? buildCustomerHistory(input.allShopifyOrders)
    : null;

  const transactionAuth = extractTransactionAuth(input.pagarmeCharge);

  const timeline = buildTimeline(input);

  const art49 = analyzeArt49(
    input.trackingEvents,
    input.chargebackDate,
    input.shopifyOrder,
  );

  const addressAnalysis = analyzeAddress(
    input.billingAddress,
    input.shippingAddress,
  );

  const reasonCode = mapReasonCode(input.reason);

  const termsAccepted = extractTermsAccepted(input.shopifyOrder);
  const refundInfo = extractRefundInfo(input.shopifyOrder, input.pagarmeCharge);
  const refundPolicyUrl = input.shopRefundPolicyUrl ?? null;

  const partial: Omit<EnrichedContext, "overallStrength" | "strengthReasons"> = {
    customerHistory,
    transactionAuth,
    timeline,
    art49,
    addressAnalysis,
    reasonCode,
    termsAccepted,
    refundInfo,
    refundPolicyUrl,
  };

  const { overallStrength, strengthReasons } = computeStrength(partial);

  return {
    ...partial,
    overallStrength,
    strengthReasons,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Formatter — gera texto para injetar no prompt da IA
═══════════════════════════════════════════════════════════════════════════ */

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

export function formatEnrichedContext(ctx: EnrichedContext): string {
  const sections: string[] = [];

  sections.push("=== CONTEXTO ENRIQUECIDO (DADOS AUTOMATIZADOS) ===");
  sections.push("");

  // Histórico do cliente
  if (ctx.customerHistory) {
    const h = ctx.customerHistory;
    sections.push("--- HISTÓRICO DO CLIENTE ---");
    sections.push(`Cliente recorrente: ${h.repeatBuyer ? "Sim" : "Não"} (${h.totalOrders} pedido(s), R$ ${h.totalSpent.toFixed(2)} total)`);
    if (h.firstOrderDate) {
      sections.push(`Primeiro pedido: ${fmtDate(h.firstOrderDate)}`);
    }
    sections.push(`Pedidos sem disputa: ${h.undisputedOrders} de ${h.totalOrders}`);
    if (h.orders.length > 1) {
      sections.push("Pedidos anteriores:");
      for (const o of h.orders.slice(0, 10)) {
        sections.push(`  - ${o.name} | ${fmtDate(o.date)} | R$ ${o.amount} | ${o.fulfillmentStatus ?? "—"}`);
      }
    }
    sections.push("");
  }

  // Autenticação da transação
  if (ctx.transactionAuth) {
    const t = ctx.transactionAuth;
    sections.push("--- AUTENTICAÇÃO DA TRANSAÇÃO ---");
    if (t.threeDSecureStatus) sections.push(`3D Secure: ${t.threeDSecureStatus}`);
    if (t.cvvResult) sections.push(`CVV: ${t.cvvResult}`);
    if (t.avsResult) sections.push(`AVS (verificação de endereço): ${t.avsResult}`);
    if (t.authorizationCode) sections.push(`Código de autorização: ${t.authorizationCode}`);
    if (t.nsu) sections.push(`NSU: ${t.nsu}`);
    if (t.antifraudScore) sections.push(`Score antifraude: ${t.antifraudScore}`);
    if (t.antifraudStatus) sections.push(`Status antifraude: ${t.antifraudStatus}`);
    if (t.cardBrand) sections.push(`Bandeira: ${t.cardBrand}`);
    if (t.cardLastFour) sections.push(`Final do cartão: ${t.cardLastFour}`);
    sections.push("");
  }

  // Timeline
  if (ctx.timeline.length > 0) {
    sections.push("--- TIMELINE DE EVIDÊNCIAS ---");
    for (const e of ctx.timeline) {
      const detail = e.detail ? ` (${e.detail})` : "";
      sections.push(`${fmtDate(e.date)} | ${e.event}${detail}`);
    }
    sections.push("");
  }

  // Art. 49 CDC
  if (ctx.art49) {
    sections.push("--- ANÁLISE ART. 49 CDC (DIREITO DE ARREPENDIMENTO) ---");
    if (ctx.art49.deliveryDate) {
      sections.push(`Entrega: ${fmtDate(ctx.art49.deliveryDate)} | Chargeback: ${fmtDate(ctx.art49.chargebackDate)}`);
    }
    sections.push(ctx.art49.analysis);
    sections.push("");
  }

  // Match de endereços
  if (ctx.addressAnalysis) {
    sections.push("--- ANÁLISE DE ENDEREÇOS ---");
    if (ctx.addressAnalysis.billingAddress) sections.push(`Faturamento: ${ctx.addressAnalysis.billingAddress}`);
    if (ctx.addressAnalysis.shippingAddress) sections.push(`Entrega: ${ctx.addressAnalysis.shippingAddress}`);
    sections.push(`Compatibilidade: ${ctx.addressAnalysis.similarityScore}% — ${ctx.addressAnalysis.details}`);
    sections.push("");
  }

  // Reason code
  if (ctx.reasonCode) {
    sections.push("--- MAPEAMENTO DE REASON CODE ---");
    sections.push(`Código: ${ctx.reasonCode.network.toUpperCase()} ${ctx.reasonCode.code} — ${ctx.reasonCode.descriptionPt}`);
    sections.push(`Evidências obrigatórias: ${ctx.reasonCode.requiredEvidence.join("; ")}`);
    sections.push(`Evidências recomendadas: ${ctx.reasonCode.recommendedEvidence.join("; ")}`);
    sections.push("");
  }

  // Aceite de termos
  if (ctx.termsAccepted !== null) {
    sections.push("--- ACEITE DE TERMOS ---");
    sections.push(ctx.termsAccepted
      ? "Aceite dos termos registrado nos atributos do checkout Shopify."
      : "Nenhum registro de aceite de termos encontrado nos atributos do checkout.");
    sections.push("");
  }

  // Estorno
  if (ctx.refundInfo) {
    sections.push("--- ESTORNO PROCESSADO ---");
    const r = ctx.refundInfo;
    sections.push(`Estorno de R$ ${(r.amount / 100).toFixed(2)} processado em ${r.date ? fmtDate(r.date) : "—"} (fonte: ${r.source})`);
    sections.push("");
  }

  // Política de reembolso
  if (ctx.refundPolicyUrl) {
    sections.push("--- POLÍTICA DE REEMBOLSO ---");
    sections.push(`URL: ${ctx.refundPolicyUrl}`);
    sections.push("");
  }

  // Força da contestação
  sections.push("--- FORÇA DA CONTESTAÇÃO ---");
  const strengthLabel = ctx.overallStrength === "strong" ? "FORTE"
    : ctx.overallStrength === "moderate" ? "MODERADA" : "FRACA";
  sections.push(`Avaliação: ${strengthLabel}`);
  if (ctx.strengthReasons.length > 0) {
    sections.push(`Motivos: ${ctx.strengthReasons.join("; ")}`);
  }

  sections.push("");
  sections.push("USE ESTES DADOS AUTOMATIZADOS para fundamentar a contestação. Inclua os pontos fortes na argumentação, cite datas e valores exatos da timeline, e referencie os artigos do CDC quando aplicável.");

  return sections.join("\n");
}
