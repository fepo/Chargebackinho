import type { FormContestacao } from "@/types";

/**
 * Template para Fraude
 * Foco: IP + fingerprint + legitimidade da transação
 */
export function getFraudeTemplate(data: FormContestacao): string {
  const itens = data.itensPedido
    .map((i) => `  • ${i.descricao} — R$ ${i.valor}`)
    .join("\n");

  const eventos = data.eventosRastreio
    .map((e) => `  ${e.data}: ${e.descricao}`)
    .join("\n");

  const comunicacoes = data.comunicacoes
    .map((c) => `  ${c.data} [${c.tipo}]: ${c.descricao}`)
    .join("\n");

  return `=== DADOS DA CONTESTAÇÃO ===
Gateway: ${data.gateway}
ID: ${data.contestacaoId}
Data: ${data.dataContestacao}
Tipo: Fraude

=== DADOS DA TRANSAÇÃO ===
Valor: R$ ${data.valorTransacao}
Bandeira: ${data.bandeira}
Final: ${data.finalCartao}
Data: ${data.dataTransacao}
IP Comprador: ${data.ipComprador}

=== DADOS DO PEDIDO ===
Número: ${data.numeroPedido}
Confirmação: ${data.codigoConfirmacao}
Itens:
${itens}

=== DADOS DO CLIENTE ===
Nome: ${data.nomeCliente}
CPF: ${data.cpfCliente}
E-mail: ${data.emailCliente}
Entrega: ${data.enderecoEntrega}
Faturamento: ${data.enderecoFaturamento}

=== DADOS DE ENTREGA ===
Transportadora: ${data.transportadora}
Rastreio: ${data.codigoRastreio}
Histórico:
${eventos || "  (sem eventos)"}

=== COMUNICAÇÕES ===
${comunicacoes || "  (nenhuma registrada)"}

=== DADOS DA EMPRESA ===
Empresa: ${data.nomeEmpresa}
CNPJ: ${data.cnpjEmpresa}
E-mail: ${data.emailEmpresa}
Telefone: ${data.telefoneEmpresa}
Endereço: ${data.enderecoEmpresa}

=== INSTRUÇÕES PARA REDAÇÃO ===
Redija resposta enfatizando:

I. AUTENTICAÇÃO - Transação passou por validação: verificação de CVV, 3D Secure, análise fraude
II. DADOS DE IDENTIDADE - CPF/ID cliente compatível com endereço de entrega
III. PADRÃO DE COMPORTAMENTO - Se cliente habitual: histórico de compras legítimas
IV. LOCALIZAÇÃO GEOGRÁFICA - IP geolocalização compatível com endereço/país (ou explicar viagem)
V. FINGERPRINT DIGITAL - Se disponível: dispositivo, navegador, padrão consistente
VI. CORRESPONDÊNCIA ENDEREÇOS - Entrega = faturamento, ou cliente confirmou divergência
VII. CONFIRMAÇÃO E ENTREGA - Cliente recebeu (rastreio) e nunca reclamou antes
VIII. ANÁLISE DE RISCO - Score de fraude baixo no momento da transação
IX. FUNDAMENTAÇÃO LEGAL - CDC art. 14 (dever de vigilância), diretrizes PCI-DSS, normas de segurança
X. CONCLUSÃO - Transação legítima, totalmente autenticada e entregue

Foque em dados técnicos e segurança. Máximo 900 palavras. Português BR.`;
}
