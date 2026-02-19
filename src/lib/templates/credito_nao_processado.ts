import type { FormContestacao } from "@/types";

/**
 * Template para Crédito Não Processado
 * Foco: Confirmação de autorização + prova de crédito pendente
 */
export function getCreditoNaoProcessadoTemplate(data: FormContestacao): string {
  const itens = data.itensPedido
    .map((i) => `  • ${i.descricao} — R$ ${i.valor}`)
    .join("\n");

  const comunicacoes = data.comunicacoes
    .map((c) => `  ${c.data} [${c.tipo}]: ${c.descricao}`)
    .join("\n");

  return `=== DADOS DA CONTESTAÇÃO ===
Gateway: ${data.gateway}
ID: ${data.contestacaoId}
Data: ${data.dataContestacao}
Tipo: Crédito Não Processado

=== DADOS DA TRANSAÇÃO ORIGINAL ===
Valor: R$ ${data.valorTransacao}
Bandeira: ${data.bandeira}
Final: ${data.finalCartao}
Data Original: ${data.dataTransacao}
Número Pedido: ${data.numeroPedido}

=== DADOS DO PEDIDO ORIGINAL ===
Confirmação: ${data.codigoConfirmacao}
Itens:
${itens}

=== DADOS DO CLIENTE ===
Nome: ${data.nomeCliente}
CPF: ${data.cpfCliente}
E-mail: ${data.emailCliente}
IP: ${data.ipComprador}

=== DADOS DA EMPRESA ===
Empresa: ${data.nomeEmpresa}
CNPJ: ${data.cnpjEmpresa}
E-mail: ${data.emailEmpresa}
Telefone: ${data.telefoneEmpresa}
Endereço: ${data.enderecoEmpresa}
Política: ${data.politicaReembolsoUrl}

=== COMUNICAÇÕES ===
${comunicacoes || "  (nenhuma registrada)"}

=== INSTRUÇÕES PARA REDAÇÃO ===
Redija resposta estruturada com:

I. AUTORIZAÇÃO ORIGINAL - Confirme que reembolso/crédito foi autorizado (data e valor exato)
II. COMPROVANTE DE PROCESSAMENTO - Código de autorização, número de processamento, ticket
III. CRONOGRAMA DO CRÉDITO - 
   Data Solicitação | Valor | Status | Código Processamento
   [detalhe cada passo]
IV. TIMING DE PROCESSAMENTO - Quanto tempo leva para crédito aparecer (padrão: 5-7 dias úteis)
V. EVIDÊNCIAS DOCUMENTAIS - 
   - Comprovante de autorização do reembolso
   - RG/CPF cliente
   - Comprovante bancário (se ya processado)
   - Comunicação ao cliente informando crédito
VI. TENTATIVA DE RESOLUÇÃO - Esforço para contatar cliente e validar recebimento
VII. PROVA DE CRÉDITO - Se já processado: extrato bancário mostrando crédito
VIII. FUNDAMENTAÇÃO LEGAL - CDC art. 26-27 (direito ao reembolso), Código Civil art. 876-890 (depósito)
IX. RESPONSABILIDADE - Claro que empresa cumpriu obrigação; cliente deve buscar com seu banco se não recebeu
X. CONCLUSÃO - Crédito foi autorizado e processado conforme política; aguarda confirmação do cliente sobre recebimento

Foque em datas/comprovantes. Máximo 850 palavras. Português BR.`;
}
