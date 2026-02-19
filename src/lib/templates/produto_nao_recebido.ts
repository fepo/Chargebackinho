import type { FormContestacao } from "@/types";

/**
 * Template para Produto/Serviço Não Recebido
 * Foco: Rastreamento + eventos de entrega com provas
 */
export function getProdutoNaoRecebidoTemplate(data: FormContestacao): string {
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
Tipo: Produto Não Recebido

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
Redija resposta enfatizando:

I. CONFIRMAÇÃO DE ENVIO - Evidencia proof of delivery (rastreio + assinatura)
II. EVENTOS DE RASTREAMENTO - Detalhe cada etapa com datas/locais exatos
III. COMPROVANTE DE ENTREGA - Assinatura, foto, ou confirmação transportadora
IV. TENTATIVA DE RESOLUÇÃO - Mostre esforço para resolver com cliente antes (emails, ligações)
V. CRONOGRAMA DETALHADO - Tabela: Data | Local | Status | Responsável
VI. FUNDAMENTAÇÃO LEGAL - CDC art. 30-31 (entrega em domicílio), Código Civil art. 476
VII. RESPONSABILIDADE TRANSPORTADORA - Se aplicável, indique responsável pelo extravio
VIII. CONCLUSÃO - Produto foi entregue conforme comprovado; cliente deve buscar ressarcimento com transportadora

Foque em datas/horários precisos. Máximo 850 palavras. Português BR.`;
}
