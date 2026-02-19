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
      Authorization: `basic ${Buffer.from(`${this.apiKey}:`).toString("base64")}`,
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
   * Lista todas as contestações (chargebacks) abertas
   * Parâmetros: status ("opened" | "won" | "lost")
   */
  async getOpenChargebacks(status: string = "opened"): Promise<Chargeback[]> {
    try {
      const response = await this.request<{
        data: any[];
        paging: { total: number };
      }>("GET", `/chargebacks?status=${status}`);

      // Mapeia resposta da API para interface local
      return response.data.map((cb) => ({
        id: cb.id,
        chargeId: cb.charge_id,
        status: cb.status as Chargeback["status"],
        amount: cb.amount,
        reason: cb.reason,
        createdAt: cb.created_at,
        respondedAt: cb.responded_at,
        evidence: cb.evidence,
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
    evidenceFile: Buffer,
    evidenceType: "document" | "email" | "other" = "document"
  ): Promise<{ status: string; message: string }> {
    try {
      // Cria form-data com arquivo
      const formData = new FormData();
      formData.append("file", new Blob([evidenceFile], { type: "application/pdf" }), `defesa_${chargebackId}.pdf`);
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
  const apiKey = process.env.PAGARME_API_KEY;
  if (!apiKey) {
    throw new Error(
      "PAGARME_API_KEY environment variable is not configured"
    );
  }
  return new PagarmeAPI(apiKey);
}
