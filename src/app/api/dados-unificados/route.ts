import { getPagarmeAPI } from "@/lib/pagarme";
import { getShopifyAPI } from "@/lib/shopify";
import type { ShopifyOrder } from "@/lib/shopify";
import { matchChargebackToShopify } from "@/lib/matchService";

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
        const result = await matchChargebackToShopify({
          metadata: cb.pagarme?.metadata ?? null,
          customerEmail: cb.pagarme?.customer?.email ?? null,
          amount: cb.amount,
          shopifyAPI,
        });
        shopify = result.order;
        matchMethod = result.method;
        matchAttempts.push(...result.attempts);
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
