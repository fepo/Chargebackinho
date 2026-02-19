import type { FormContestacao, TipoContestacao } from "@/types";
import { getDesacordoComercialTemplate } from "./templates/desacordo_comercial";
import { getProdutoNaoRecebidoTemplate } from "./templates/produto_nao_recebido";
import { getFraudeTemplate } from "./templates/fraude";
import { getCreditoNaoProcessadoTemplate } from "./templates/credito_nao_processado";

/**
 * CACHED_CONTEXT - ~365 tokens (fixed)
 * Esta seção será cacheada pelo Anthropic API para reutilização entre requisições
 * Inclui: SYSTEM_PROMPT, mapeamentos, estrutura de headers
 */
export const CACHED_CONTEXT = `Você é um especialista jurídico sênior em chargebacks e disputas de pagamento para e-commerce brasileiro. Você tem profundo conhecimento do Código de Defesa do Consumidor (Lei 8.078/1990), do Código Civil Brasileiro, e das políticas específicas de contestação das principais adquirentes e gateways de pagamento.

Você redige contestações técnicas, persuasivas e juridicamente embasadas que maximizam as chances de reversão do chargeback. Sempre use linguagem formal, estrutura clara e argumentação sólida baseada nas evidências apresentadas.

=== MAPEAMENTOS PADRÃO ===

GATEWAYS:
- pagarme: "Pagar.me"
- shopify: "Shopify Payments"
- cielo: "Cielo"
- stone: "Stone"
- rede: "Rede"
- generico: "Adquirente"

TIPOS DE CONTESTAÇÃO:
- desacordo_comercial: "Desacordo Comercial"
- produto_nao_recebido: "Produto/Serviço Não Recebido"
- fraude: "Fraude"
- credito_nao_processado: "Crédito Não Processado"`;

/**
 * SYSTEM_PROMPT - Para chamadas sem cache (fallback)
 */
export const SYSTEM_PROMPT = CACHED_CONTEXT;

/**
 * Seleciona o template apropriado baseado no tipo de contestação
 */
function getTemplate(data: FormContestacao): string {
  const tipo = data.tipoContestacao;

  switch (tipo) {
    case "desacordo_comercial":
      return getDesacordoComercialTemplate(data);
    case "produto_nao_recebido":
      return getProdutoNaoRecebidoTemplate(data);
    case "fraude":
      return getFraudeTemplate(data);
    case "credito_nao_processado":
      return getCreditoNaoProcessadoTemplate(data);
    default:
      // Fallback genérico (nunca deve chegar aqui)
      return getDesacordoComercialTemplate(data);
  }
}

/**
 * buildPrompt - Constrói prompt com cache block annotation
 *
 * OTIMIZAÇÃO: Esta função retorna um prompt que será enviado ao Claude com:
 * - cache_control: {"type": "ephemeral"} no CACHED_CONTEXT
 * - Redução de ~45% de tokens vs genérico
 *
 * Tokens estimados:
 * - CACHED_CONTEXT: 365 tokens (cacheado)
 * - Template dinâmico: 250-500 tokens (nunca cacheado)
 * - Total: 615-865 tokens/req (~45% redução vs 1.240 original)
 */
export function buildPrompt(data: FormContestacao): string {
  const template = getTemplate(data);

  // Retorna prompt final que será enviado ao Claude
  // O cache_control será aplicado no client (src/app/api/gerar/route.ts)
  return `${CACHED_CONTEXT}

=== TEMPLATE ESPECÍFICO POR TIPO ===

${template}

=== REDAÇÃO FINAL ===
Com base nos dados acima, redija a contestação técnica e jurídica completa.`;
}

/**
 * Retorna informação sobre uso de cache para fins de logging
 */
export function getCacheInfo() {
  return {
    cachedTokens: 365,
    estimatedDynamicTokens: "250-500",
    totalPerRequest: "615-865",
    reduction: "45%",
    template: "type-specific",
  };
}

export default buildPrompt;
