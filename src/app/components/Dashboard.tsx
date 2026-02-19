"use client";

import { useState, useEffect, useCallback } from "react";
import DossieModal from "./DossieModal";

interface Chargeback {
  id: string;
  chargeId: string;
  status: string;
  amount: number;
  reason: string;
  createdAt: string;
  orderId: string | null;
  customerName: string;
  customerEmail: string;
}

interface DashboardProps {
  onSelectChargeback?: (chargeback: Chargeback) => void;
}

interface DossieState {
  isOpen: boolean;
  titulo: string;
  dossie: string;
  temShopify: boolean;
  loading: boolean;
}

const REASON_LABELS: Record<string, string> = {
  chargeback_reversal: "Devolução de Chargeback",
  duplicate_processing: "Processamento Duplicado",
  excessive_amount: "Valor Excessivo",
  fraud: "Fraude",
  general_dispute: "Disputa Geral",
  incorrect_amount: "Valor Incorreto",
  insufficient_fund: "Fundo Insuficiente",
  no_cancellation_rights: "Sem Direitos de Cancelamento",
  not_authorized: "Não Autorizado",
  not_received: "Não Recebido",
  product_unacceptable: "Produto Inaceitável",
  questionable_merchant: "Comerciante Questionável",
  recurring_transaction_cancelled: "Transação Recorrente Cancelada",
  service_cancelled: "Serviço Cancelado",
  service_issue: "Problema no Serviço",
};

export default function Dashboard({ onSelectChargeback }: DashboardProps) {
  const [chargebacks, setChargebacks] = useState<Chargeback[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [stats, setStats] = useState<{
    total: number;
    totalAmount: number;
    byReason: Record<string, number>;
  }>({ total: 0, totalAmount: 0, byReason: {} });

  const [dossie, setDossie] = useState<DossieState>({
    isOpen: false,
    titulo: "",
    dossie: "",
    temShopify: false,
    loading: false,
  });

  // Carrega contestações (webhook store + API Pagar.me, sem duplicatas)
  const loadChargebacks = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        fetch("/api/pagarme/chargebacks").then(r => r.ok ? r.json() : []),
        fetch("/api/pagarme/list-chargebacks").then(r => r.ok ? r.json() : []),
      ]);

      const webhookData: Chargeback[] = results[0].status === "fulfilled" ? results[0].value : [];
      const apiData: Chargeback[] = results[1].status === "fulfilled" ? results[1].value : [];

      // Merge sem duplicatas (webhook tem prioridade)
      const seen = new Set(webhookData.map((c) => c.id));
      const merged = [
        ...webhookData,
        ...apiData.filter((c) => !seen.has(c.id)),
      ];

      setChargebacks(merged);

      const total = merged.length;
      const totalAmount = merged.reduce((sum: number, cb: Chargeback) => sum + cb.amount, 0);
      const byReason: Record<string, number> = {};
      merged.forEach((cb: Chargeback) => {
        byReason[cb.reason] = (byReason[cb.reason] || 0) + 1;
      });

      setStats({ total, totalAmount, byReason });
      setLastUpdate(new Date().toLocaleTimeString("pt-BR"));
    } catch (error) {
      console.error("Erro ao carregar contestações:", error);
    }
    setLoading(false);
  }, []);

  // Carrega ao montar
  useEffect(() => {
    loadChargebacks();
  }, [loadChargebacks]);

  // Auto-refresh a cada 30s
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadChargebacks();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, loadChargebacks]);

  // Filtra contestações
  const filtered = chargebacks.filter((cb) => {
    if (filterStatus !== "all" && cb.status !== filterStatus) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        cb.id.toLowerCase().includes(term) ||
        cb.customerName.toLowerCase().includes(term) ||
        cb.customerEmail.toLowerCase().includes(term) ||
        cb.orderId?.toLowerCase().includes(term)
      );
    }
    return true;
  });

  // Extrai dossiê de defesa
  const handleExtractDossie = async (cb: Chargeback) => {
    setDossie((prev) => ({ ...prev, loading: true }));
    try {
      // 1. Busca Shopify (se houver numeroPedido)
      let shopifyOrder = null;
      if (cb.orderId) {
        try {
          const shopRes = await fetch(`/api/shopify/get-order?orderName=${cb.orderId}`);
          if (shopRes.ok) {
            const data = await shopRes.json();
            if (data.success) {
              shopifyOrder = data.order;
            }
          }
        } catch (err) {
          console.log("Shopify não disponível:", err);
        }
      }

      // 2. Cria FormContestacao mínimo com dados do chargeback
      const contestacao = {
        gateway: "pagarme" as const,
        contestacaoId: cb.id,
        dataContestacao: cb.createdAt,
        tipoContestacao: "desacordo_comercial" as const,
        valorTransacao: String(cb.amount),
        bandeira: "",
        finalCartao: "",
        dataTransacao: cb.createdAt,
        numeroPedido: cb.orderId || "",
        itensPedido: [],
        codigoConfirmacao: "",
        nomeCliente: cb.customerName,
        cpfCliente: "",
        emailCliente: cb.customerEmail,
        enderecoEntrega: "",
        enderecoFaturamento: "",
        ipComprador: "",
        transportadora: "",
        codigoRastreio: "",
        eventosRastreio: [],
        comunicacoes: [],
        nomeEmpresa: "",
        cnpjEmpresa: "",
        emailEmpresa: "",
        telefoneEmpresa: "",
        enderecoEmpresa: "",
        politicaReembolsoUrl: "",
      };

      // 3. Chama /api/gerar-dossie
      const res = await fetch("/api/gerar-dossie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contestacao,
          chargebackData: cb,
          shopifyOrder,
        }),
      });

      if (!res.ok) {
        throw new Error("Erro ao gerar dossiê");
      }

      const data = await res.json();

      setDossie({
        isOpen: true,
        titulo: data.titulo,
        dossie: data.dossie,
        temShopify: data.temShopify,
        loading: false,
      });
    } catch (error) {
      console.error("Erro ao extrair dossiê:", error);
      alert("Erro ao extrair dossiê: " + (error instanceof Error ? error.message : "desconhecido"));
      setDossie((prev) => ({ ...prev, loading: false }));
    }
  };

  // Exporta dossiê como PDF
  const handleExportPDF = async (content: string, filename: string) => {
    try {
      const res = await fetch("/api/exportar-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: content, titulo: filename.replace(".pdf", "") }),
      });

      if (!res.ok) throw new Error("Erro ao exportar PDF");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert("Erro ao exportar PDF: " + (error instanceof Error ? error.message : "desconhecido"));
    }
  };

  // Exporta dossiê como DOCX
  const handleExportDocx = async (content: string, filename: string) => {
    try {
      const res = await fetch("/api/exportar-docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: content, titulo: filename.replace(".docx", "") }),
      });

      if (!res.ok) throw new Error("Erro ao exportar DOCX");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert("Erro ao exportar DOCX: " + (error instanceof Error ? error.message : "desconhecido"));
    }
  };

  return (
    <div className="space-y-6">
      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 font-medium">Total de Contestações</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
          <p className="text-xs text-gray-400 mt-2">Abertas aguardando resposta</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 font-medium">Valor Total em Disputa</p>
          <p className="text-3xl font-bold text-red-600 mt-1">R$ {stats.totalAmount.toFixed(2)}</p>
          <p className="text-xs text-gray-400 mt-2">Somando todas as contestações</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 font-medium">Motivo Mais Comum</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {Object.entries(stats.byReason).sort(([, a], [, b]) => b - a)[0]?.[1] || 0}
          </p>
          <p className="text-xs text-gray-400 mt-2 truncate">
            {Object.entries(stats.byReason).sort(([, a], [, b]) => b - a)[0]?.[0]
              ? REASON_LABELS[Object.entries(stats.byReason).sort(([, a], [, b]) => b - a)[0][0]] ||
              Object.entries(stats.byReason).sort(([, a], [, b]) => b - a)[0][0]
              : "N/A"}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 font-medium">Última Atualização</p>
          <p className="text-2xl font-bold text-gray-900 mt-1 text-sm">
            {lastUpdate || "—"}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <div
              className={`w-2 h-2 rounded-full ${autoRefresh ? "bg-green-500 animate-pulse" : "bg-gray-300"
                }`}
            />
            <p className="text-xs text-gray-400">
              {autoRefresh ? "Auto-refresh ativo" : "Auto-refresh desativo"}
            </p>
          </div>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-1 min-w-fit">
            <input
              type="text"
              placeholder="Buscar por ID, cliente, email ou pedido..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input flex-1 min-w-64"
            />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input w-40"
            >
              <option value="all">Todos os Status</option>
              <option value="opened">Aberto</option>
              <option value="submitted">Respondido</option>
              <option value="won">Ganho</option>
              <option value="lost">Perdido</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${autoRefresh
                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
            >
              {autoRefresh ? "🔄 Auto" : "⏸ Manual"}
            </button>
            <button
              onClick={() => loadChargebacks()}
              disabled={loading}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              {loading ? "Carregando..." : "↻ Atualizar"}
            </button>
          </div>
        </div>
      </div>

      {/* Lista de Contestações */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">
            Contestações {filtered.length > 0 && `(${filtered.length})`}
          </h3>
        </div>
        <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 text-sm">
                {chargebacks.length === 0
                  ? "Nenhuma contestação aberta no Pagar.me"
                  : "Nenhuma contestação corresponde aos filtros"}
              </p>
            </div>
          ) : (
            filtered.map((cb) => (
              <div key={cb.id} className="p-4 hover:bg-gray-50 transition">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelectChargeback?.(cb)}>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-900 truncate">
                        {cb.customerName}
                      </p>
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${cb.status === "opened"
                            ? "bg-red-100 text-red-700"
                            : cb.status === "submitted"
                              ? "bg-yellow-100 text-yellow-700"
                              : cb.status === "won"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-700"
                          }`}
                      >
                        {cb.status === "opened"
                          ? "Aberto"
                          : cb.status === "submitted"
                            ? "Respondido"
                            : cb.status === "won"
                              ? "Ganho"
                              : "Perdido"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 truncate">
                      {cb.customerEmail}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                      <span>ID: {cb.id}</span>
                      {cb.orderId && <span>Pedido: #{cb.orderId}</span>}
                      <span>{new Date(cb.createdAt).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 flex flex-col items-end gap-2">
                    <div>
                      <p className="font-bold text-lg text-red-600">
                        R$ {cb.amount.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {REASON_LABELS[cb.reason] || cb.reason}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExtractDossie(cb);
                      }}
                      disabled={dossie.loading}
                      className="btn-secondary text-xs px-2 py-1 whitespace-nowrap disabled:opacity-50"
                    >
                      {dossie.loading ? "⏳ Extraindo..." : "📋 Dossiê"}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal de Dossiê */}
      <DossieModal
        isOpen={dossie.isOpen}
        titulo={dossie.titulo}
        dossie={dossie.dossie}
        temShopify={dossie.temShopify}
        onClose={() => setDossie((prev) => ({ ...prev, isOpen: false }))}
        onExportPDF={handleExportPDF}
        onExportDocx={handleExportDocx}
      />
    </div>
  );
}
