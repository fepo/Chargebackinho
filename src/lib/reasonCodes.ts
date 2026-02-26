/**
 * Mapeamento de reason codes de chargeback (Visa, Mastercard, Elo)
 * para evidências obrigatórias e recomendadas.
 *
 * Fontes: Visa CE3.0, Mastercard Chargeback Guide, Elo Regulamento.
 */

export interface ReasonCodeInfo {
  network: "visa" | "mastercard" | "elo" | "unknown";
  code: string;
  description: string;
  descriptionPt: string;
  requiredEvidence: string[];
  recommendedEvidence: string[];
  winRateHint: "high" | "medium" | "low";
}

const REASON_CODES: Record<string, ReasonCodeInfo> = {
  // ── Visa ────────────────────────────────────────────────────────────────
  "10.4": {
    network: "visa",
    code: "10.4",
    description: "Other Fraud - Card Absent Environment",
    descriptionPt: "Fraude — Ambiente sem cartão presente",
    requiredEvidence: [
      "Autenticação 3D Secure (se disponível)",
      "IP do comprador e geolocalização",
      "Fingerprint do dispositivo",
      "Comprovante de entrega no endereço do titular",
    ],
    recommendedEvidence: [
      "Transações anteriores não disputadas do mesmo dispositivo/IP (CE3.0)",
      "Match de AVS (Address Verification Service)",
      "CVV compatível",
      "Score antifraude da transação",
    ],
    winRateHint: "medium",
  },
  "13.1": {
    network: "visa",
    code: "13.1",
    description: "Merchandise/Services Not Received",
    descriptionPt: "Mercadoria/serviço não recebido",
    requiredEvidence: [
      "Comprovante de entrega com rastreio completo",
      "Data de entrega confirmada",
      "Endereço de entrega igual ao do titular",
    ],
    recommendedEvidence: [
      "Assinatura ou foto de entrega",
      "Comunicações com o cliente",
      "Timeline completa do pedido",
    ],
    winRateHint: "high",
  },
  "13.2": {
    network: "visa",
    code: "13.2",
    description: "Cancelled Recurring Transaction",
    descriptionPt: "Transação recorrente cancelada",
    requiredEvidence: [
      "Prova de que o cancelamento não foi solicitado antes da cobrança",
      "Termos da assinatura aceitos pelo cliente",
    ],
    recommendedEvidence: [
      "Logs de comunicação",
      "Política de cancelamento publicada",
    ],
    winRateHint: "medium",
  },
  "13.3": {
    network: "visa",
    code: "13.3",
    description: "Not as Described or Defective",
    descriptionPt: "Produto diferente do descrito ou com defeito",
    requiredEvidence: [
      "Descrição do produto conforme publicada no site",
      "Nota fiscal detalhada",
      "Política de troca/reembolso",
    ],
    recommendedEvidence: [
      "Fotos do produto enviado",
      "Comunicações sobre troca/devolução",
      "Comprovante de que reembolso parcial foi oferecido",
    ],
    winRateHint: "low",
  },
  "13.6": {
    network: "visa",
    code: "13.6",
    description: "Credit Not Processed",
    descriptionPt: "Crédito não processado",
    requiredEvidence: [
      "Comprovante de estorno/crédito processado (se aplicável)",
      "Protocolo da solicitação de reembolso",
    ],
    recommendedEvidence: [
      "Prazo de processamento informado ao cliente",
      "Comunicações sobre o status do reembolso",
    ],
    winRateHint: "medium",
  },
  "13.7": {
    network: "visa",
    code: "13.7",
    description: "Cancelled Merchandise/Services",
    descriptionPt: "Mercadoria/serviço cancelado",
    requiredEvidence: [
      "Prova de que o serviço foi prestado ou mercadoria entregue antes do cancelamento",
      "Política de cancelamento aceita pelo cliente",
    ],
    recommendedEvidence: [
      "Comunicações sobre o cancelamento",
      "Comprovante de reembolso parcial (se aplicável)",
    ],
    winRateHint: "medium",
  },

  // ── Mastercard ──────────────────────────────────────────────────────────
  "4837": {
    network: "mastercard",
    code: "4837",
    description: "No Cardholder Authorization",
    descriptionPt: "Transação não autorizada pelo titular",
    requiredEvidence: [
      "Prova de autenticação (3DS, CVV, AVS)",
      "IP do comprador",
      "Comprovante de entrega no endereço do titular",
    ],
    recommendedEvidence: [
      "Fingerprint do dispositivo",
      "Histórico de compras do mesmo cliente",
      "Score antifraude",
    ],
    winRateHint: "medium",
  },
  "4853": {
    network: "mastercard",
    code: "4853",
    description: "Cardholder Dispute",
    descriptionPt: "Disputa do titular do cartão",
    requiredEvidence: [
      "Comprovante de entrega com rastreio",
      "Nota fiscal",
      "Descrição do produto/serviço conforme publicado",
    ],
    recommendedEvidence: [
      "Comunicações com o cliente",
      "Política de reembolso aceita no checkout",
      "Aceite dos termos de uso",
    ],
    winRateHint: "medium",
  },
  "4863": {
    network: "mastercard",
    code: "4863",
    description: "Cardholder Does Not Recognize",
    descriptionPt: "Titular não reconhece a transação",
    requiredEvidence: [
      "Dados de autenticação (3DS, CVV)",
      "IP e dispositivo do comprador",
      "Comprovante de entrega",
    ],
    recommendedEvidence: [
      "Histórico de compras anteriores",
      "Comunicações pós-venda",
    ],
    winRateHint: "medium",
  },

  // ── Elo ─────────────────────────────────────────────────────────────────
  "elo_fraud": {
    network: "elo",
    code: "Fraude",
    description: "Fraud",
    descriptionPt: "Transação fraudulenta (Elo)",
    requiredEvidence: [
      "Autenticação da transação (3DS se disponível)",
      "IP do comprador",
      "Comprovante de entrega no endereço do titular",
    ],
    recommendedEvidence: [
      "Score antifraude",
      "Fingerprint do dispositivo",
      "Transações anteriores do mesmo cliente",
    ],
    winRateHint: "medium",
  },
  "elo_disagreement": {
    network: "elo",
    code: "Desacordo",
    description: "Commercial Disagreement",
    descriptionPt: "Desacordo comercial (Elo)",
    requiredEvidence: [
      "Nota fiscal",
      "Comprovante de entrega com rastreio",
      "Descrição do produto conforme publicado",
    ],
    recommendedEvidence: [
      "Política de troca/reembolso",
      "Comunicações com o cliente",
    ],
    winRateHint: "medium",
  },
  "elo_not_received": {
    network: "elo",
    code: "Não recebido",
    description: "Not Received",
    descriptionPt: "Produto não recebido (Elo)",
    requiredEvidence: [
      "Comprovante de entrega com rastreio completo",
      "Data e local de entrega",
    ],
    recommendedEvidence: [
      "Assinatura de recebimento",
      "Comunicações com o cliente",
    ],
    winRateHint: "high",
  },
};

/**
 * Mapeia o campo `reason` do chargeback para um ReasonCodeInfo.
 * Tenta match exato primeiro, depois busca parcial no texto.
 */
export function mapReasonCode(reason: string): ReasonCodeInfo | null {
  if (!reason) return null;

  const normalized = reason.trim().toLowerCase();

  // Match exato por código (ex: "13.1", "4853")
  if (REASON_CODES[reason.trim()]) {
    return REASON_CODES[reason.trim()];
  }

  // Match parcial no texto do reason
  for (const [, info] of Object.entries(REASON_CODES)) {
    const terms = [
      info.code.toLowerCase(),
      info.description.toLowerCase(),
      info.descriptionPt.toLowerCase(),
    ];
    if (terms.some((t) => normalized.includes(t) || t.includes(normalized))) {
      return info;
    }
  }

  // Heurística por palavras-chave
  if (/fraud|fraude/.test(normalized)) {
    return REASON_CODES["10.4"]; // Default fraud
  }
  if (/not.?received|n[aã]o.?receb/.test(normalized)) {
    return REASON_CODES["13.1"];
  }
  if (/credit|cr[eé]dito|refund|estorno/.test(normalized)) {
    return REASON_CODES["13.6"];
  }
  if (/disagree|desacordo|dispute|disputa/.test(normalized)) {
    return REASON_CODES["4853"];
  }

  return null;
}
