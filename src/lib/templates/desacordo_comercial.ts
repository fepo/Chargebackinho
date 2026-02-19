import type { FormContestacao } from "@/types";

/**
 * Template para Desacordo Comercial
 * Foco: Entrega comprovada + correspondência de endereços
 */
export function getDesacordoComercialTemplate(data: FormContestacao): string {
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
Tipo: Desacordo Comercial

=== DADOS DA TRANSAÇÃO ===
Valor: R$ ${data.valorTransacao}
Bandeira: ${data.bandeira}
Final: ${data.finalCartao}
Data: ${data.dataTransacao}

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
IP: ${data.ipComprador}

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
Política: ${data.politicaReembolsoUrl}

=== INSTRUÇÕES PARA REDAÇÃO ===
Redija resposta estruturada com:

I. IDENTIFICAÇÃO - Confirme legitimidade: endereço entrega = faturamento, IP consistente
II. CORRESPONDÊNCIA DE DADOS - Mostre que endereços coincidem (ou explique divergência legítima)
III. ENTREGA COMPROVADA - Detalhe rastreamento com datas exatas
IV. CRONOGRAMA - Tabela: Data | Evento | Evidência
V. FUNDAMENTAÇÃO JURÍDICA - CDC art. 14-17, Código Civil art. 395-398
VI. EVIDÊNCIAS - Documento de entrega, confirmação cliente, histórico rastreio
VII. CONCLUSÃO - Solicite reversão por compra legítima entregue

Use tom formal. Máximo 800 palavras. Português BR.`;
}
