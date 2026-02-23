/**
 * matchService.ts
 *
 * Serviço de cruzamento Pagar.me ↔ Shopify.
 * Extraído de dados-unificados/route.ts para ser reutilizável.
 *
 * Prioridade de match:
 *   1. metadata → número do pedido Shopify (busca exata)
 *   2. email do cliente → pedido com valor ±5%
 *   3. email do cliente → primeiro pedido (fallback)
 *   4. sem match automático → retorna null (busca manual na UI)
 */

import type { ShopifyOrder } from "@/lib/shopify";

export type MatchMethod =
  | "metadata_order_number"
  | "email_valor_match"
  | "email_primeiro_pedido"
  | "manual"
  | null;

export interface MatchResult {
  order: ShopifyOrder | null;
  method: MatchMethod;
  attempts: string[];
}

/** Interface mínima necessária do cliente Shopify para o match. */
interface ShopifyLookup {
  getOrderByName: (name: string) => Promise<ShopifyOrder | null>;
  getOrdersByEmail: (email: string) => Promise<ShopifyOrder[]>;
}

const KNOWN_METADATA_KEYS = [
  "order_number",
  "shopify_order",
  "shopify_order_number",
  "shopify_order_id",
  "pedido",
  "numero_pedido",
  "order_name",
  "shopify_name",
  "external_order_id",
  "external_id",
  "reference",
  "ref",
] as const;

/**
 * Tenta extrair o número do pedido Shopify a partir dos metadados da transação.
 *
 * Suporta chaves conhecidas e uma varredura genérica restrita a valores que
 * parecem exatamente um número de pedido Shopify (#1234 ou 1234), com 3–7 dígitos.
 * O padrão restrito evita falsos positivos com CPF, telefone, CEP, etc.
 */
export function extractShopifyOrderNumber(
  metadata: Record<string, unknown> | null
): string | null {
  if (!metadata) return null;

  for (const key of KNOWN_METADATA_KEYS) {
    const val = metadata[key];
    if (typeof val === "string" && val.trim()) return val.trim();
    if (typeof val === "number") return String(val);
  }

  // Varredura genérica: aceita somente strings que sejam EXATAMENTE #NNNNN ou NNNNN (3–7 dígitos)
  for (const val of Object.values(metadata)) {
    if (typeof val === "string") {
      const m = val.match(/^#?(\d{3,7})$/);
      if (m) return m[1];
    }
  }

  return null;
}

/**
 * Tenta fazer o match do chargeback com um pedido Shopify.
 * Retorna o pedido encontrado, o método utilizado e o log de tentativas.
 */
export async function matchChargebackToShopify(params: {
  metadata: Record<string, unknown> | null;
  customerEmail: string | null;
  /** Valor em BRL (não em centavos) */
  amount: number;
  shopifyAPI: ShopifyLookup;
}): Promise<MatchResult> {
  const { metadata, customerEmail, amount, shopifyAPI } = params;
  const attempts: string[] = [];

  // ── Estratégia 1: número do pedido no metadata ──────────────────────────
  const orderNumber = extractShopifyOrderNumber(metadata);
  if (orderNumber) {
    attempts.push(`metadata → getOrderByName("${orderNumber}")`);
    try {
      const order = await shopifyAPI.getOrderByName(orderNumber);
      if (order) {
        return { order, method: "metadata_order_number", attempts };
      }
      attempts.push(`"${orderNumber}" não encontrado na Shopify`);
    } catch (e) {
      attempts.push(
        `erro ao buscar por nome "${orderNumber}": ${e instanceof Error ? e.message : "desconhecido"}`
      );
    }
  }

  // ── Estratégia 2: email → pedidos + match por valor ─────────────────────
  if (customerEmail) {
    attempts.push(`email → getOrdersByEmail("${customerEmail}")`);
    try {
      const orders = await shopifyAPI.getOrdersByEmail(customerEmail);

      if (orders.length === 0) {
        attempts.push("email → 0 pedidos encontrados");
        return { order: null, method: null, attempts };
      }

      attempts.push(`email → ${orders.length} pedido(s) encontrado(s)`);

      if (amount > 0) {
        const valueMatch = orders.find((o) => {
          const total = parseFloat(o.totalPrice);
          return !isNaN(total) && total > 0 && Math.abs(total - amount) / amount <= 0.05;
        });

        if (valueMatch) {
          return { order: valueMatch, method: "email_valor_match", attempts };
        }

        attempts.push("nenhum pedido com valor ±5% → usando primeiro pedido como fallback");
      }

      return { order: orders[0], method: "email_primeiro_pedido", attempts };
    } catch (e) {
      attempts.push(
        `erro ao buscar por email: ${e instanceof Error ? e.message : "desconhecido"}`
      );
    }
  } else {
    attempts.push("sem email do cliente — busca automática impossível");
  }

  return { order: null, method: null, attempts };
}

/** Labels legíveis para exibição na UI. */
export const MATCH_METHOD_LABELS: Record<NonNullable<MatchMethod>, string> = {
  metadata_order_number: "Metadata (nº pedido)",
  email_valor_match: "Email + valor",
  email_primeiro_pedido: "Email (fallback)",
  manual: "Busca manual",
};
