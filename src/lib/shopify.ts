/**
 * Shopify API Client
 * Para buscar pedidos e dados de fulfillment
 */

export interface ShopifyCustomer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  defaultAddress?: {
    address1: string;
    address2?: string;
    city: string;
    province: string;
    country: string;
    zip: string;
  };
}

export interface ShopifyLineItem {
  id: string;
  title: string;
  quantity: number;
  price: string;
  sku: string | null;
  variantId: string | null;
}

export interface ShopifyFulfillment {
  id: string;
  status: "pending" | "open" | "in_transit" | "delivered" | "failure" | "confirmed" | "cancelled" | "error";
  createdAt: string;
  updatedAt: string;
  trackingInfo?: {
    number: string | null;
    company: string | null;
    url: string | null;
  };
  fulfillmentLineItems: Array<{
    id: string;
    quantity: number;
    lineItemId: string;
  }>;
}

export interface ShopifyRefund {
  id: string;
  createdAt: string;
  totalAmount: number; // em centavos
}

export interface ShopifyOrder {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  customer?: ShopifyCustomer;
  lineItems: ShopifyLineItem[];
  fulfillments: ShopifyFulfillment[];
  totalPrice: string;
  subtotalPrice: string;
  taxPrice: string;
  shippingPrice: string;
  currency: string;
  financialStatus: "authorized" | "pending" | "paid" | "partially_paid" | "refunded" | "voided" | "partially_refunded" | "any" | "authorized" | "pending";
  fulfillmentStatus: "fulfilled" | "partial" | "restocked" | "pending" | "scheduled" | "on_demand" | null;
  tags: string[];
  customAttributes: Array<{ key: string; value: string }>;
  note: string | null;
  refunds: ShopifyRefund[];
}

export class ShopifyAPI {
  private apiUrl: string;
  private accessToken: string;

  constructor(storeUrl: string, accessToken: string, apiVersion: string = "2024-10") {
    if (!storeUrl || !accessToken) {
      throw new Error("Shopify store URL and access token are required");
    }

    // Remove protocol and trailing slash
    const cleanUrl = storeUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
    this.apiUrl = `https://${cleanUrl}/admin/api/${apiVersion}`;
    this.accessToken = accessToken;
  }

  /**
   * Realiza requisição GraphQL à API Shopify
   */
  private async request<T>(query: string, variables?: Record<string, any>): Promise<T> {
    const url = `${this.apiUrl}/graphql.json`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": this.accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Shopify API error: ${response.status} ${text}`);
    }

    const data = await response.json();

    if (data.errors) {
      throw new Error(`Shopify GraphQL error: ${JSON.stringify(data.errors)}`);
    }

    return data.data as T;
  }

  /**
   * Busca um pedido pelo nome (ex: "#1001" ou "1001")
   */
  async getOrderByName(orderName: string): Promise<ShopifyOrder | null> {
    try {
      const cleanName = orderName.replace(/^#/, "");

      const query = `
        query SearchOrders($query: String!) {
          orders(first: 1, query: $query) {
            edges {
              node {
                id
                name
                email
                createdAt
                updatedAt
                customer {
                  id
                  email
                  firstName
                  lastName
                  phone
                  defaultAddress {
                    address1
                    address2
                    city
                    province
                    country
                    zip
                  }
                }
                lineItems(first: 100) {
                  edges {
                    node {
                      id
                      title
                      quantity
                      originalUnitPriceSet {
                        shopMoney {
                          amount
                        }
                      }
                      sku
                    }
                  }
                }
                fulfillments {
                  id
                  status
                  createdAt
                  updatedAt
                  trackingInfo {
                    number
                    company
                    url
                  }
                  fulfillmentLineItems(first: 100) {
                    edges {
                      node {
                        id
                        quantity
                        lineItem {
                          id
                        }
                      }
                    }
                  }
                }
                totalPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                subtotalPriceSet {
                  shopMoney {
                    amount
                  }
                }
                totalTaxSet {
                  shopMoney {
                    amount
                  }
                }
                totalShippingPriceSet {
                  shopMoney {
                    amount
                  }
                }
                displayFinancialStatus
                displayFulfillmentStatus
                tags
                customAttributes {
                  key
                  value
                }
                note
                refunds(first: 5) {
                  id
                  createdAt
                  totalRefundedSet {
                    shopMoney {
                      amount
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const result = await this.request<{
        orders: {
          edges: Array<{
            node: any;
          }>;
        };
      }>(query, { query: `name:${cleanName}` });

      if (!result.orders.edges.length) {
        return null;
      }

      const node = result.orders.edges[0].node;
      return this.mapOrderResponse(node);
    } catch (error) {
      console.error(`Erro ao buscar order ${orderName}:`, error);
      return null;
    }
  }

  /**
   * Busca pedidos por email do cliente
   */
  async getOrdersByEmail(email: string): Promise<ShopifyOrder[]> {
    try {
      const query = `
        query SearchOrders($query: String!) {
          orders(first: 50, query: $query) {
            edges {
              node {
                id
                name
                email
                createdAt
                updatedAt
                customer {
                  id
                  email
                  firstName
                  lastName
                  phone
                  defaultAddress {
                    address1
                    address2
                    city
                    province
                    country
                    zip
                  }
                }
                lineItems(first: 100) {
                  edges {
                    node {
                      id
                      title
                      quantity
                      originalUnitPriceSet {
                        shopMoney {
                          amount
                        }
                      }
                      sku
                    }
                  }
                }
                fulfillments {
                  id
                  status
                  createdAt
                  updatedAt
                  trackingInfo {
                    number
                    company
                    url
                  }
                  fulfillmentLineItems(first: 100) {
                    edges {
                      node {
                        id
                        quantity
                        lineItem {
                          id
                        }
                      }
                    }
                  }
                }
                totalPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                subtotalPriceSet {
                  shopMoney {
                    amount
                  }
                }
                totalTaxSet {
                  shopMoney {
                    amount
                  }
                }
                totalShippingPriceSet {
                  shopMoney {
                    amount
                  }
                }
                displayFinancialStatus
                displayFulfillmentStatus
                tags
                customAttributes {
                  key
                  value
                }
                note
                refunds(first: 5) {
                  id
                  createdAt
                  totalRefundedSet {
                    shopMoney {
                      amount
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const result = await this.request<{
        orders: {
          edges: Array<{
            node: any;
          }>;
        };
      }>(query, { query: `email:${email}` });

      return result.orders.edges.map(edge => this.mapOrderResponse(edge.node));
    } catch (error) {
      console.error(`Erro ao buscar orders por email ${email}:`, error);
      return [];
    }
  }

  /**
   * Mapeia resposta GraphQL para interface ShopifyOrder
   */
  private mapOrderResponse(node: any): ShopifyOrder {
    return {
      id: node.id,
      name: node.name,
      email: node.email,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      customer: node.customer
        ? {
            id: node.customer.id,
            email: node.customer.email,
            firstName: node.customer.firstName,
            lastName: node.customer.lastName,
            phone: node.customer.phone,
            defaultAddress: node.customer.defaultAddress || undefined,
          }
        : undefined,
      lineItems: (node.lineItems?.edges || []).map((edge: any) => ({
        id: edge.node.id,
        title: edge.node.title,
        quantity: edge.node.quantity,
        price: edge.node.originalUnitPriceSet?.shopMoney?.amount || edge.node.price?.amount || "0",
        sku: edge.node.sku,
        variantId: edge.node.variant?.id || null,
      })),
      // fulfillments is a direct array in 2024-10 (not edges/node)
      fulfillments: (Array.isArray(node.fulfillments) ? node.fulfillments : (node.fulfillments?.edges || []).map((e: any) => e.node)).map((f: any) => ({
        id: f.id,
        status: f.status?.toLowerCase?.() ?? f.status,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
        trackingInfo: Array.isArray(f.trackingInfo) ? f.trackingInfo[0] : (f.trackingInfo || undefined),
        fulfillmentLineItems: (f.fulfillmentLineItems?.edges || []).map((fli: any) => ({
          id: fli.node.id,
          quantity: fli.node.quantity,
          lineItemId: fli.node.lineItem?.id,
        })),
      })),
      totalPrice: node.totalPriceSet?.shopMoney?.amount || "0",
      subtotalPrice: node.subtotalPriceSet?.shopMoney?.amount || "0",
      taxPrice: node.totalTaxSet?.shopMoney?.amount || node.taxPriceSet?.shopMoney?.amount || "0",
      shippingPrice: node.totalShippingPriceSet?.shopMoney?.amount || node.shippingPriceSet?.shopMoney?.amount || "0",
      currency: node.totalPriceSet?.shopMoney?.currencyCode || "BRL",
      financialStatus: (node.displayFinancialStatus ?? node.financialStatus)?.toLowerCase?.() ?? null,
      fulfillmentStatus: (node.displayFulfillmentStatus ?? node.fulfillmentStatus)?.toLowerCase?.() ?? null,
      tags: node.tags || [],
      customAttributes: node.customAttributes || [],
      note: node.note || null,
      refunds: (node.refunds || []).map((r: any) => ({
        id: r.id,
        createdAt: r.createdAt,
        totalAmount: Math.round(parseFloat(r.totalRefundedSet?.shopMoney?.amount ?? "0") * 100),
      })),
    };
  }

  /**
   * Busca a URL da política de reembolso da loja
   */
  async getShopRefundPolicyUrl(): Promise<string | null> {
    try {
      const query = `
        query {
          shop {
            refundPolicy {
              url
            }
          }
        }
      `;
      const result = await this.request<{ shop: { refundPolicy: { url: string } | null } }>(query);
      return result.shop?.refundPolicy?.url ?? null;
    } catch (error) {
      console.error("[shopify] getShopRefundPolicyUrl:", error);
      return null;
    }
  }
}

/**
 * Cria instância de API client com variáveis de ambiente
 */
export function getShopifyAPI(): ShopifyAPI | null {
  const storeUrl = process.env.SHOPIFY_STORE_URL;
  const accessToken = process.env.SHOPIFY_API_ACCESS_TOKEN;
  const apiVersion = process.env.SHOPIFY_API_VERSION || "2024-10";

  if (!storeUrl || !accessToken) {
    return null;
  }

  return new ShopifyAPI(storeUrl, accessToken, apiVersion);
}
