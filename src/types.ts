export type Gateway =
  | "pagarme"
  | "shopify"
  | "cielo"
  | "stone"
  | "rede"
  | "generico";

export type TipoContestacao =
  | "desacordo_comercial"
  | "produto_nao_recebido"
  | "fraude"
  | "credito_nao_processado";

export interface ItemPedido {
  descricao: string;
  valor: string;
}

export interface EventoRastreio {
  data: string;
  descricao: string;
}

export interface Comunicacao {
  data: string;
  tipo: string; // "email" | "whatsapp" | "telefone" etc.
  descricao: string;
}

export interface CustomerHistory {
  totalOrders: number;
  totalSpent: number; // em centavos
  firstOrderDate: string | null;
  lastOrderDate: string | null;
}

export interface FormContestacao {
  // Dados da contestação
  gateway: Gateway;
  contestacaoId: string;
  dataContestacao: string;
  tipoContestacao: TipoContestacao;

  // Dados da transação
  valorTransacao: string;
  bandeira: string;
  finalCartao: string;
  dataTransacao: string;

  // Dados do pedido
  numeroPedido: string;
  itensPedido: ItemPedido[];
  codigoConfirmacao: string;

  // Dados do cliente
  nomeCliente: string;
  cpfCliente: string;
  emailCliente: string;
  enderecoEntrega: string;
  enderecoFaturamento: string;
  ipComprador: string;

  // Dados de entrega
  transportadora: string;
  codigoRastreio: string;
  eventosRastreio: EventoRastreio[];

  // Comunicações
  comunicacoes: Comunicacao[];

  // Dados da empresa
  nomeEmpresa: string;
  cnpjEmpresa: string;
  emailEmpresa: string;
  telefoneEmpresa: string;
  enderecoEmpresa: string;
  politicaReembolsoUrl: string;
}
