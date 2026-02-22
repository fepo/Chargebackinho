import { getPagarmeAPI } from "@/lib/pagarme";
import { getShopifyAPI } from "@/lib/shopify";
import type { ShopifyOrder } from "@/lib/shopify";

/**
 * Tenta extrair o número do pedido Shopify a partir do metadata do Pagar.me
 * ou de campos que possam conter referência ao pedido.
 * Lojistas costumam salvar o nº Shopify em campos como:
 *   metadata.order_number, metadata.shopify_order, metadata.pedido, etc.
 */
function extractShopifyOrderNumber(metadata: Record<string, any> | null, pagarmeOrderId: string | null): string | null {
  if (metadata) {
    // Campos comuns onde lojistas armazenam o nº do pedido Shopify
    const possibleKeys = [
      "order_number", "shopify_order", "shopify_order_number", "shopify_order_id",
      "pedido", "numero_pedido", "order_name", "shopify_name",
      "external_order_id", "external_id", "reference", "ref",
    ];
    for (const key of possibleKeys) {
      const val = metadata[key];
      if (val && typeof val === "string" && val.trim()) {
        return val.trim();
      }
      // Pode ser numérico
      if (val && typeof val === "number") {
        return String(val);
      }
    }

    // Busca genérica: qualquer valor no metadata que pareça um número de pedido Shopify (#1234 ou só 1234)
    for (const [, val] of Object.entries(metadata)) {
      if (typeof val === "string") {
        const match = val.match(/#?(\d{3,6})/);
        if (match) return match[1];
      }
    }
  }

  // O orderId do Pagar.me (or_xxxx) NÃO é o número Shopify — não usar
  return null;
}

/**
 * GET /api/dados-unificados
 *
 * Busca chargebacks do Pagar.me e tenta enriquecer cada um com dados da Shopify,
 * retornando uma visão unificada para o painel "Dados".
 */
export async function GET() {
  const results: any[] = [];
  let pagarmeError: string | null = null;
  let shopifyError: string | null = null;
  let shopifyConfigured = false;

  // ── 1. Pagar.me ──────────────────────────────────────────────────────────
  let chargebacks: any[] = [];
  try {
    const apiKey = process.env.PAGARME_API_KEY;
    if (!apiKey) {
      pagarmeError = "PAGARME_API_KEY não configurada";
    } else {
      const pagarme = getPagarmeAPI();
      const raw = await pagarme.getOpenChargebacks();

      // Enriquece com dados do pedido e charge completo
      chargebacks = await Promise.all(
        raw.map(async (cb) => {
          let orderId: string | null = null;
          let order: any = null;
          let chargeRaw: any = null;
          let customerEmail: string | null = null;
          let customerName: string | null = null;

          try {
            // Busca charge completo para extrair order_id e dados do customer da transação
            chargeRaw = await pagarme.getCharge(cb.chargeId);
            orderId = chargeRaw?.order_id ?? chargeRaw?.order?.id ?? null;

            // Extrair email/nome do customer dentro do charge ou da transação
            customerEmail = chargeRaw?.customer?.email
              ?? chargeRaw?.last_transaction?.customer?.email
              ?? null;
            customerName = chargeRaw?.customer?.name
              ?? chargeRaw?.last_transaction?.customer?.name
              ?? null;

            if (orderId) {
              order = await pagarme.getOrder(orderId);
            }
          } catch (e) {
            console.warn(`Dados-unificados: erro ao buscar charge/order ${cb.chargeId}:`, e instanceof Error ? e.message : e);
          }

          // Consolidar dados do cliente (charge > order)
          const customer = order?.customer ?? (customerEmail || customerName ? {
            name: customerName ?? "Desconhecido",
            email: customerEmail ?? "",
            documentNumber: chargeRaw?.customer?.document ?? null,
            phoneNumber: chargeRaw?.customer?.phones?.mobile_phone ?? null,
          } : null);

          return {
            id: cb.id,
            chargeId: cb.chargeId,
            status: cb.status,
            amount: cb.amount / 100,
            reason: cb.reason,
            createdAt: cb.createdAt,
            orderId: orderId ?? null,
            pagarme: {
              customer: customer,
              billingAddress: order?.billingAddress ?? chargeRaw?.billing_address ?? null,
              shippingAddress: order?.shippingAddress ?? chargeRaw?.shipping_address ?? null,
              items: order?.items ?? chargeRaw?.items ?? [],
              metadata: order?.metadata ?? chargeRaw?.metadata ?? null,
              chargesCount: order?.chargesCount ?? 0,
              orderStatus: order?.status ?? null,
              orderAmount: order?.amount ? order.amount / 100 : null,
              closedAt: order?.closedAt ?? null,
              // Raw fields for debug
              _chargeKeys: chargeRaw ? Object.keys(chargeRaw) : [],
            },
          };
        })
      );
    }
  } catch (e) {
    pagarmeError = e instanceof Error ? e.message : "Erro desconhecido ao buscar Pagar.me";
  }

  // ── 2. Shopify ───────────────────────────────────────────────────────────
  const shopifyAPI = getShopifyAPI();
  shopifyConfigured = !!shopifyAPI;

  for (const cb of chargebacks) {
    let shopify: Partial<ShopifyOrder> | null = null;
    const matchAttempts: string[] = [];
    let matchMethod: string | null = null;

    if (shopifyAPI) {
      try {
        const email = cb.pagarme?.customer?.email;
        const metadata = cb.pagarme?.metadata;

        // --- Estratégia 1: Buscar pelo número do pedido Shopify no metadata do Pagar.me
        // Muitos lojistas colocam o número Shopify no metadata da order/charge
        const shopifyOrderNumber = extractShopifyOrderNumber(metadata, cb.orderId);
        if (shopifyOrderNumber) {
          matchAttempts.push(`metadata → getOrderByName("${shopifyOrderNumber}")`);
          const order = await shopifyAPI.getOrderByName(shopifyOrderNumber);
          if (order) {
            shopify = order;
            matchMethod = "metadata_order_number";
          }
        }

        // --- Estratégia 2: Buscar por email do cliente
        if (!shopify && email) {
          matchAttempts.push(`email → getOrdersByEmail("${email}")`);
          const orders = await shopifyAPI.getOrdersByEmail(email);
          if (orders.length) {
            matchAttempts.push(`email retornou ${orders.length} pedido(s)`);
            // Match por valor (5% tolerância)
            if (cb.amount > 0) {
              const match = orders.find((o) => {
                const orderTotal = parseFloat(o.totalPrice);
                if (isNaN(orderTotal) || orderTotal === 0) return false;
                const diff = Math.abs(orderTotal - cb.amount) / cb.amount;
                return diff <= 0.05;
              });
              shopify = match ?? orders[0];
              matchMethod = match ? "email_valor_match" : "email_primeiro_pedido";
            } else {
              shopify = orders[0];
              matchMethod = "email_primeiro_pedido";
            }
          } else {
            matchAttempts.push("email → 0 pedidos encontrados");
          }
        }

        if (!shopify && !email) {
          matchAttempts.push("sem email do cliente — não foi possível buscar na Shopify");
        }
      } catch (e) {
        if (!shopifyError) {
          shopifyError = e instanceof Error ? e.message : "Erro ao buscar Shopify";
        }
        matchAttempts.push(`erro: ${e instanceof Error ? e.message : "desconhecido"}`);
      }
    }

    results.push({
      ...cb,
      _matchDebug: {
        pagarmeOrderId: cb.orderId,
        customerEmail: cb.pagarme?.customer?.email ?? null,
        customerName: cb.pagarme?.customer?.name ?? null,
        metadataKeys: cb.pagarme?.metadata ? Object.keys(cb.pagarme.metadata) : [],
        chargeKeys: cb.pagarme?._chargeKeys ?? [],
        matchMethod,
        attempts: matchAttempts,
        matched: !!shopify,
      },
      shopify: shopify
        ? {
            orderId: shopify.id,
            orderName: shopify.name,
            email: shopify.email,
            customer: shopify.customer
              ? {
                  name: `${shopify.customer.firstName ?? ""} ${shopify.customer.lastName ?? ""}`.trim(),
                  email: shopify.customer.email,
                  phone: shopify.customer.phone,
                  address: shopify.customer.defaultAddress,
                }
              : null,
            lineItems: (shopify.lineItems ?? []).map((i) => ({
              title: i.title,
              quantity: i.quantity,
              price: i.price,
              sku: i.sku,
            })),
            fulfillments: (shopify.fulfillments ?? []).map((f) => ({
              status: f.status,
              createdAt: f.createdAt,
              tracking: f.trackingInfo ?? null,
            })),
            totalPrice: shopify.totalPrice,
            currency: shopify.currency,
            financialStatus: shopify.financialStatus,
            fulfillmentStatus: shopify.fulfillmentStatus,
            tags: shopify.tags,
          }
        : null,
    });
  }

  return Response.json({
    chargebacks: results,
    meta: {
      total: results.length,
      pagarmeOk: !pagarmeError,
      pagarmeError,
      shopifyOk: shopifyConfigured && !shopifyError,
      shopifyConfigured,
      shopifyError,
      fetchedAt: new Date().toISOString(),
    },
  });
}
