"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface ChargebackItem {
  id: string;
  chargeId?: string;
  status: string;
  amount: number;
  reason: string;
  createdAt: string;
  orderId?: string | null;
  customerName: string;
  customerEmail: string;
  rascunho?: any;
  // Dados enriquecidos da Shopify
  shopifyOrderName?: string;
  shopifyFulfillmentStatus?: string;
  shopifyTrackingNumber?: string;
  shopifyTrackingCompany?: string;
  shopifyTrackingUrl?: string;
}

interface DashboardProps {
  onSelectChargeback?: (chargeback: ChargebackItem) => void;
  onNewManual?: () => void;
}

const REASON_LABELS: Record<string, string> = {
  chargeback_reversal: "Devolução de Chargeback",
  duplicate_processing: "Processamento Duplicado",
  excessive_amount: "Valor Excessivo",
  fraud: "Fraude",
  general_dispute: "Disputa Geral",
  incorrect_amount: "Valor Incorreto",
  insufficient_fund: "Fundo Insuficiente",
  not_received: "Produto Não Recebido",
  product_unacceptable: "Produto Inaceitável",
  not_authorized: "Não Autorizado",
  service_cancelled: "Serviço Cancelado",
  service_issue: "Problema no Serviço",
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  opened: { label: "Aguardando", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-400" },
  submitted: { label: "Respondido", bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-400" },
  won: { label: "Ganho", bg: "bg-green-50", text: "text-green-700", dot: "bg-green-400" },
  lost: { label: "Perdido", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-400" },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d atrás`;
  if (h > 0) return `${h}h atrás`;
  if (m > 0) return `${m}min atrás`;
  return "agora";
}

export default function Dashboard({ onSelectChargeback, onNewManual }: DashboardProps) {
  const router = useRouter();
  const [items, setItems] = useState<ChargebackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [pulse, setPulse] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r1, r2] = await Promise.allSettled([
        fetch("/api/pagarme/chargebacks").then(r => r.ok ? r.json() : []),
        fetch("/api/pagarme/list-chargebacks").then(r => r.ok ? r.json() : []),
      ]);

      const from_webhook: ChargebackItem[] = r1.status === "fulfilled" ? r1.value : [];
      const from_api: ChargebackItem[] = r2.status === "fulfilled" ? r2.value : [];

      const seen = new Set(from_webhook.map(c => c.id));
      const merged = [...from_webhook, ...from_api.filter(c => !seen.has(c.id))];
      merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setItems(merged);
      setLastUpdate(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
      setPulse(true);
      setTimeout(() => setPulse(false), 1000);
    } catch (e) {
      console.error("Erro ao carregar chargebacks:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [autoRefresh, load]);

  const filtered = items.filter(cb => {
    if (filterStatus !== "all" && cb.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        cb.id.toLowerCase().includes(q) ||
        cb.customerName.toLowerCase().includes(q) ||
        cb.customerEmail.toLowerCase().includes(q) ||
        (cb.orderId ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Stats
  const total = items.length;
  const totalAmount = items.reduce((s, c) => s + c.amount, 0);
  const pending = items.filter(c => c.status === "opened").length;
  const won = items.filter(c => c.status === "won").length;

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard de Chargebacks</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Contestações recebidas via Pagar.me · atualizado às {lastUpdate || "—"}
          </p>
        </div>
        <button
          onClick={onNewManual}
          className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-medium px-4 py-2.5 rounded-xl text-sm transition-all shadow-sm hover:shadow-md"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nova Contestação
        </button>
      </div>

      {/* ── Stats cards ────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: total, color: "text-gray-900", accent: "bg-gray-500" },
          { label: "Em risco", value: formatCurrency(totalAmount), color: "text-red-600", accent: "bg-red-500" },
          { label: "Aguardando", value: pending, color: "text-amber-600", accent: "bg-amber-500" },
          { label: "Ganhos", value: won, color: "text-green-600", accent: "bg-green-500" },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-1 h-full ${s.accent}`} />
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{s.label}</p>
            <p className={`text-xl font-bold ${s.color} tabular-nums`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Toolbar ────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por ID, cliente ou pedido..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          >
            <option value="all">Todos os Status</option>
            <option value="opened">Aguardando</option>
            <option value="submitted">Respondido</option>
            <option value="won">Ganho</option>
            <option value="lost">Perdido</option>
          </select>

          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(v => !v)}
            className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg font-medium transition-colors ${autoRefresh
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-gray-100 text-gray-600 border border-gray-200"
              }`}
          >
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
            {autoRefresh ? "Auto" : "Manual"}
          </button>

          {/* Refresh button */}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Atualizar
          </button>
        </div>
      </div>

      {/* ── Chargebacks list ───────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-sm">
            Chargebacks {filtered.length > 0 && <span className="text-gray-400 font-normal">({filtered.length})</span>}
          </h3>
          {pulse && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              Atualizado
            </span>
          )}
        </div>

        {/* Loading skeleton */}
        {loading && items.length === 0 && (
          <div className="divide-y divide-gray-100">
            {[1, 2, 3].map(i => (
              <div key={i} className="p-5 animate-pulse flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-100 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-48" />
                  <div className="h-3 bg-gray-100 rounded w-64" />
                </div>
                <div className="h-4 bg-gray-100 rounded w-24" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="py-20 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-gray-500 font-medium">
              {items.length === 0
                ? "Nenhum chargeback recebido ainda"
                : "Nenhum chargeback corresponde ao filtro"}
            </p>
            <p className="text-gray-400 text-sm mt-1">
              {items.length === 0
                ? "Os chargebacks do Pagar.me aparecerão aqui automaticamente via webhook"
                : "Tente ajustar os filtros"}
            </p>
          </div>
        )}

        {/* Items */}
        <div className="divide-y divide-gray-100">
          {filtered.map(cb => {
            const st = STATUS_CONFIG[cb.status] ?? STATUS_CONFIG.opened;
            const initials = (cb.customerName || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
            const colors = ["bg-violet-100 text-violet-600", "bg-blue-100 text-blue-600", "bg-pink-100 text-pink-600", "bg-emerald-100 text-emerald-600"];
            const avatarColor = colors[cb.id.charCodeAt(0) % colors.length];

            return (
              <div key={cb.id} className="px-5 py-4 hover:bg-gray-50/80 transition-colors group">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5 ${avatarColor}`}>
                    {initials}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    {/* Row 1: Nome + Status + Razão */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm truncate max-w-[200px]">
                        {cb.customerName || "Cliente desconhecido"}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${st.bg} ${st.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                        {REASON_LABELS[cb.reason] ?? cb.reason}
                      </span>
                    </div>

                    {/* Row 2: Metadata compacta */}
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-400">
                      {cb.customerEmail && (
                        <span className="truncate max-w-[180px]">{cb.customerEmail}</span>
                      )}
                      {cb.customerEmail && (cb.orderId || cb.shopifyOrderName) && (
                        <span className="text-gray-300">·</span>
                      )}
                      {cb.shopifyOrderName ? (
                        <span className="text-gray-600 font-medium">{cb.shopifyOrderName}</span>
                      ) : cb.orderId ? (
                        <span>Pedido #{cb.orderId}</span>
                      ) : null}
                      {cb.shopifyFulfillmentStatus === "fulfilled" && (
                        <span className="px-1.5 py-0.5 bg-green-50 text-green-600 rounded text-xs font-medium">Entregue</span>
                      )}
                      {cb.shopifyFulfillmentStatus === "partial" && (
                        <span className="px-1.5 py-0.5 bg-yellow-50 text-yellow-600 rounded text-xs font-medium">Parcial</span>
                      )}
                      {cb.shopifyTrackingNumber && (
                        <>
                          <span className="text-gray-300">·</span>
                          {cb.shopifyTrackingUrl ? (
                            <a href={cb.shopifyTrackingUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline font-mono">
                              {cb.shopifyTrackingNumber}
                            </a>
                          ) : (
                            <span className="font-mono text-gray-500">{cb.shopifyTrackingNumber}</span>
                          )}
                        </>
                      )}
                      <span className="text-gray-300">·</span>
                      <span>{timeAgo(cb.createdAt)}</span>
                    </div>
                  </div>

                  {/* Amount + Action */}
                  <div className="flex-shrink-0 flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold text-red-600 text-sm tabular-nums">{formatCurrency(cb.amount)}</p>
                    </div>
                    <button
                      onClick={() => {
                        sessionStorage.setItem(`cb_analyze_${cb.id}`, JSON.stringify(cb));
                        router.push(`/analisar/${cb.id}`);
                      }}
                      className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors shadow-sm"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Analisar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer note */}
      {items.length > 0 && (
        <p className="text-center text-xs text-gray-400">
          Atualização automática a cada 15 segundos · {items.length} chargeback{items.length !== 1 ? "s" : ""} no total
        </p>
      )}

    </div>
  );
}
