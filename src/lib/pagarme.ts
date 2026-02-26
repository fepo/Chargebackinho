import crypto from "crypto";

/**
 * Interface para Chargeback da Pagar.me
 */
export interface Chargeback {
  id: string;
  chargeId: string;
  status: "opened" | "won" | "lost" | "refunded" | "submitted";
  amount: number;
  reason: string;
  createdAt: string;
  respondedAt?: string;
  evidence?: {
    document?: string;
    email?: string;
    other?: string;
  };
}

/**
 * Interface para Order da Pagar.me
 */
export interface Order {
  id: string;
  customerId: string;
  amount: number;
  status: string;
  chargesCount: number;
  items: Array<{
    id: string;
    description: string;
    amount: number;
    quantity: number;
  }>;
  customer: {
    id: string;
    name: string;
    email: string;
    documentNumber: string;
    phoneNumber?: string;
  };
  billingAddress: {
    line1: string;
    line2?: string;
    zipCode: string;
    city: string;
    state: string;
    country: string;
  };
  shippingAddress?: {
    line1: string;
    line2?: string;
    zipCode: string;
    city: string;
    state: string;
    country: string;
  };
  metadata?: Record<string, any>;
  createdAt: string;
  closedAt?: string;
}

/**
 * Pagar.me API Client
 * Documentação: https://pagar.me/docs/
 */
export class PagarmeAPI {
  private apiKey: string;
  private baseUrl = "https://api.pagar.me/core/v5";

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("Pagar.me API key is required");
    }
    this.apiKey = apiKey;
  }

  /**
   * Realiza requisição HTTP com autenticação
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString("base64")}`,
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Pagar.me API error: ${response.status} ${error}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Lista charges com chargeback (status=chargedback)
   * Na API v5 da Pagar.me, chargebacks são charges com status chargedback
   */
  async getOpenChargebacks(): Promise<Chargeback[]> {
    try {
      const response = await this.request<{
        data: any[];
        paging: { total: number };
      }>("GET", `/charges?status=chargedback&size=50`);

      if (!response.data || !Array.isArray(response.data)) return [];

      // Mapeia charges para interface de Chargeback
      return response.data.map((charge) => ({
        id: charge.id,
        chargeId: charge.id,
        status: "opened" as Chargeback["status"],
        amount: charge.amount || 0,
        reason: charge?.metadata?.chargeback_reason ||
          charge?.last_transaction?.gateway_response?.errors?.[0]?.message ||
          "Chargeback",
        createdAt: charge.created_at,
        respondedAt: undefined,
        evidence: undefined,
      }));
    } catch (error) {
      console.error("Erro ao listar chargebacks:", error);
      throw error;
    }
  }

  /**
   * Busca detalhes de um chargeback específico
   */
  async getChargeback(chargebackId: string): Promise<Chargeback> {
    try {
      const response = await this.request<any>(
        "GET",
        `/chargebacks/${chargebackId}`
      );

      return {
        id: response.id,
        chargeId: response.charge_id,
        status: response.status,
        amount: response.amount,
        reason: response.reason,
        createdAt: response.created_at,
        respondedAt: response.responded_at,
        evidence: response.evidence,
      };
    } catch (error) {
      console.error(`Erro ao buscar chargeback ${chargebackId}:`, error);
      throw error;
    }
  }

  /**
   * Busca detalhes de um pedido (order)
   */
  async getOrder(orderId: string): Promise<Order> {
    try {
      const response = await this.request<any>("GET", `/orders/${orderId}`);

      return {
        id: response.id,
        customerId: response.customer_id,
        amount: response.amount,
        status: response.status,
        chargesCount: response.charges?.length || 0,
        items: response.items || [],
        customer: {
          id: response.customer?.id,
          name: response.customer?.name,
          email: response.customer?.email,
          documentNumber: response.customer?.document,
          phoneNumber: response.customer?.phones?.mobile_phone,
        },
        billingAddress: response.billing_address,
        shippingAddress: response.shipping_address,
        metadata: response.metadata,
        createdAt: response.created_at,
        closedAt: response.closed_at,
      };
    } catch (error) {
      console.error(`Erro ao buscar order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Busca pedidos de um cliente pelo email
   * Fluxo: GET /customers?email → GET /orders?customer_id
   */
  async findOrdersByCustomerEmail(email: string): Promise<Order[]> {
    try {
      // 1. Localiza o cliente pelo email
      const customersResp = await this.request<{ data: any[] }>(
        "GET",
        `/customers?email=${encodeURIComponent(email)}&size=5`
      );

      if (!customersResp.data?.length) return [];

      const customerId: string = customersResp.data[0].id;

      // 2. Lista os pedidos do cliente
      const ordersResp = await this.request<{ data: any[] }>(
        "GET",
        `/orders?customer_id=${encodeURIComponent(customerId)}&size=50`
      );

      if (!ordersResp.data?.length) return [];

      return ordersResp.data.map((o) => ({
        id: o.id,
        customerId: o.customer_id,
        amount: o.amount,
        status: o.status,
        chargesCount: o.charges?.length ?? 0,
        items: o.items ?? [],
        customer: {
          id: o.customer?.id ?? customerId,
          name: o.customer?.name ?? "",
          email: o.customer?.email ?? email,
          documentNumber: o.customer?.document ?? "",
          phoneNumber: o.customer?.phones?.mobile_phone,
        },
        billingAddress: o.billing_address,
        shippingAddress: o.shipping_address,
        metadata: o.metadata,
        createdAt: o.created_at,
        closedAt: o.closed_at,
      }));
    } catch (error) {
      console.error(`[pagarme] findOrdersByCustomerEmail(${email}):`, error);
      return [];
    }
  }

  /**
   * Busca detalhes de um charge (cobrança)
   */
  async getCharge(chargeId: string): Promise<any> {
    try {
      return await this.request<any>("GET", `/charges/${chargeId}`);
    } catch (error) {
      console.error(`Erro ao buscar charge ${chargeId}:`, error);
      throw error;
    }
  }

  /**
   * Submete defesa para um chargeback
   * O body deve conter as informações de defesa em formato específico
   */
  async submitChargebackDefense(
    chargebackId: string,
    evidenceFile: Buffer | Uint8Array,
    evidenceType: "document" | "email" | "other" = "document"
  ): Promise<{ status: string; message: string }> {
    try {
      // Cria form-data com arquivo
      const formData = new FormData();
      const buffer = Buffer.isBuffer(evidenceFile) ? evidenceFile : Buffer.from(evidenceFile);
      formData.append("file", new Blob([buffer.toString("base64")], { type: "application/pdf" }), `defesa_${chargebackId}.pdf`);
      formData.append("evidence_type", evidenceType);

      const response = await fetch(
        `${this.baseUrl}/chargebacks/${chargebackId}/defenses`,
        {
          method: "POST",
          headers: {
            Authorization: `basic ${Buffer.from(`${this.apiKey}:`).toString("base64")}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Pagar.me API error: ${response.status} ${error}`);
      }

      const data = await response.json();
      return {
        status: "submitted",
        message: `Defesa submetida com sucesso para chargeback ${chargebackId}`,
      };
    } catch (error) {
      console.error(`Erro ao submeter defesa ${chargebackId}:`, error);
      throw error;
    }
  }

  /**
   * Valida assinatura de webhook da Pagar.me
   * Usa algoritmo HMAC SHA-256
   */
  static validateWebhookSignature(
    payload: string,
    signature: string,
    webhookSecret: string
  ): boolean {
    try {
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(payload)
        .digest("hex");

      return signature === expectedSignature;
    } catch (error) {
      console.error("Erro ao validar assinatura webhook:", error);
      return false;
    }
  }

  /**
   * Parse webhook payload
   */
  static parseWebhookPayload(payload: string): {
    id: string;
    type: string;
    data: any;
    timestamp: string;
  } {
    return JSON.parse(payload);
  }
}

/**
 * Cria instância de API client com variável de ambiente
 */
export function getPagarmeAPI(): PagarmeAPI {
  const apiKey = process.env.PAGARME_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "PAGARME_API_KEY environment variable is not configured"
    );
  }
  return new PagarmeAPI(apiKey);
}
