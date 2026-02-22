"use client";

import { useState, useEffect, useCallback } from "react";

/* ── Tipos ──────────────────────────────────────────────────────────────── */
interface PagarmeCustomer {
  id?: string;
  name?: string;
  email?: string;
  documentNumber?: string;
  phoneNumber?: string;
}

interface PagarmeData {
  customer: PagarmeCustomer | null;
  billingAddress: Record<string, string> | null;
  shippingAddress: Record<string, string> | null;
  items: Array<{ description: string; amount: number; quantity: number }>;
  metadata: Record<string, any> | null;
  chargesCount: number;
  orderStatus: string | null;
  orderAmount: number | null;
  closedAt: string | null;
}

interface ShopifyLineItem {
  title: string;
  quantity: number;
  price: string;
  sku: string | null;
}

interface ShopifyFulfillment {
  status: string;
  createdAt: string;
  tracking: { number: string | null; company: string | null; url: string | null } | null;
}

interface ShopifyData {
  orderId: string;
  orderName: string;
  email: string;
  customer: { name: string; email: string; phone: string | null; address: Record<string, string> | null } | null;
  lineItems: ShopifyLineItem[];
  fulfillments: ShopifyFulfillment[];
  totalPrice: string;
  currency: string;
  financialStatus: string;
  fulfillmentStatus: string | null;
  tags: string[];
}

interface UnifiedChargeback {
  id: string;
  chargeId: string;
  status: string;
  amount: number;
  reason: string;
  createdAt: string;
  orderId: string | null;
  pagarme: PagarmeData;
  shopify: ShopifyData | null;
  _matchDebug?: {
    pagarmeOrderId: string | null;
    customerEmail: string | null;
    metadataKeys: string[];
    matchMethod: string | null;
    attempts: string[];
    matched: boolean;
  };
}

interface ApiMeta {
  total: number;
  pagarmeOk: boolean;
  pagarmeError: string | null;
  shopifyOk: boolean;
  shopifyConfigured: boolean;
  shopifyError: string | null;
  fetchedAt: string;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */
const REASON_LABELS: Record<string, string> = {
  chargeback_reversal: "Devolução",
  duplicate_processing: "Duplicado",
  excessive_amount: "Valor Excessivo",
  fraud: "Fraude",
  general_dispute: "Disputa Geral",
  incorrect_amount: "Valor Incorreto",
  not_received: "Não Recebido",
  product_unacceptable: "Produto Inaceitável",
  not_authorized: "Não Autorizado",
  service_cancelled: "Serviço Cancelado",
  service_issue: "Problema Serviço",
};

const FULFILLMENT_LABELS: Record<string, { label: string; cls: string }> = {
  fulfilled: { label: "Entregue", cls: "bg-green-100 text-green-700" },
  partial: { label: "Parcial", cls: "bg-yellow-100 text-yellow-700" },
  pending: { label: "Pendente", cls: "bg-gray-100 text-gray-600" },
  restocked: { label: "Devolvido", cls: "bg-purple-100 text-purple-700" },
  delivered: { label: "Entregue", cls: "bg-green-100 text-green-700" },
  in_transit: { label: "Em Trânsito", cls: "bg-blue-100 text-blue-700" },
  confirmed: { label: "Confirmado", cls: "bg-blue-100 text-blue-700" },
};

const FINANCIAL_LABELS: Record<string, { label: string; cls: string }> = {
  paid: { label: "Pago", cls: "bg-green-100 text-green-700" },
  pending: { label: "Pendente", cls: "bg-yellow-100 text-yellow-700" },
  refunded: { label: "Reembolsado", cls: "bg-red-100 text-red-700" },
  partially_refunded: { label: "Parcial Reemb.", cls: "bg-orange-100 text-orange-700" },
  authorized: { label: "Autorizado", cls: "bg-blue-100 text-blue-700" },
  voided: { label: "Cancelado", cls: "bg-gray-100 text-gray-600" },
};

function formatCurrency(value: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAddress(addr: Record<string, string> | null | undefined) {
  if (!addr) return "—";
  return [addr.line1 || addr.address1, addr.line2 || addr.address2, addr.city, addr.state || addr.province, addr.zipCode || addr.zip, addr.country]
    .filter(Boolean)
    .join(", ");
}

/* ── Componente Principal ───────────────────────────────────────────────── */
export default function DadosPage() {
  const [data, setData] = useState<UnifiedChargeback[]>([]);
  const [meta, setMeta] = useState<ApiMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [manualSearch, setManualSearch] = useState<{ cbId: string; query: string } | null>(null);
  const [manualLoading, setManualLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dados-unificados");
      const json = await res.json();
      setData(json.chargebacks ?? []);
      setMeta(json.meta ?? null);
    } catch (e) {
      console.error("Erro ao carregar dados unificados:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Busca manual de pedido Shopify por número
  const handleManualShopifySearch = async (cbId: string, orderName: string) => {
    if (!orderName.trim()) return;
    setManualLoading(true);
    try {
      const res = await fetch(`/api/shopify/get-order?orderName=${encodeURIComponent(orderName.trim())}`);
      const json = await res.json();
      if (json.success && json.order) {
        const order = json.order;
        setData((prev) =>
          prev.map((cb) =>
            cb.id === cbId
              ? {
                  ...cb,
                  shopify: {
                    orderId: order.id,
                    orderName: order.name,
                    email: order.email,
                    customer: order.customer
                      ? {
                          name: `${order.customer.firstName ?? ""} ${order.customer.lastName ?? ""}`.trim(),
                          email: order.customer.email,
                          phone: order.customer.phone,
                          address: order.customer.defaultAddress,
                        }
                      : null,
                    lineItems: (order.lineItems ?? []).map((i: any) => ({
                      title: i.title,
                      quantity: i.quantity,
                      price: i.price,
                      sku: i.sku,
                    })),
                    fulfillments: (order.fulfillments ?? []).map((f: any) => ({
                      status: f.status,
                      createdAt: f.createdAt,
                      tracking: f.trackingInfo ?? null,
                    })),
                    totalPrice: order.totalPrice,
                    currency: order.currency,
                    financialStatus: order.financialStatus,
                    fulfillmentStatus: order.fulfillmentStatus,
                    tags: order.tags ?? [],
                  },
                  _matchDebug: { ...cb._matchDebug!, matchMethod: "manual", matched: true, attempts: [...(cb._matchDebug?.attempts ?? []), `manual → "${orderName}"`] },
                }
              : cb
          )
        );
        setManualSearch(null);
      } else {
        alert(json.error || "Pedido não encontrado na Shopify");
      }
    } catch {
      alert("Erro ao buscar na Shopify");
    } finally {
      setManualLoading(false);
    }
  };

  const filtered = data.filter((cb) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      cb.id.toLowerCase().includes(q) ||
      (cb.orderId ?? "").toLowerCase().includes(q) ||
      (cb.pagarme.customer?.name ?? "").toLowerCase().includes(q) ||
      (cb.pagarme.customer?.email ?? "").toLowerCase().includes(q) ||
      (cb.shopify?.orderName ?? "").toLowerCase().includes(q) ||
      (cb.shopify?.customer?.name ?? "").toLowerCase().includes(q)
    );
  });

  const toggle = (id: string) => setExpanded((prev) => (prev === id ? null : id));

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dados Unificados</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Pagar.me + Shopify — visualize tudo antes de gerar a defesa
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-medium px-4 py-2.5 rounded-xl text-sm transition-all shadow-sm hover:shadow-md disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {loading ? "Carregando…" : "Atualizar"}
        </button>
      </div>

      {/* ── Status das APIs ─────────────────────────────────── */}
      {meta && (
        <div className="grid grid-cols-2 gap-4">
          <div className={`border rounded-xl p-4 ${meta.pagarmeOk ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2.5 h-2.5 rounded-full ${meta.pagarmeOk ? "bg-green-500" : "bg-red-500"}`} />
              <span className="font-semibold text-sm text-gray-800">Pagar.me</span>
            </div>
            <p className="text-xs text-gray-500">
              {meta.pagarmeOk ? `${meta.total} chargeback(s) encontrado(s)` : meta.pagarmeError}
            </p>
          </div>
          <div className={`border rounded-xl p-4 ${meta.shopifyOk ? "bg-green-50 border-green-200" : meta.shopifyConfigured ? "bg-yellow-50 border-yellow-200" : "bg-gray-50 border-gray-200"}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2.5 h-2.5 rounded-full ${meta.shopifyOk ? "bg-green-500" : meta.shopifyConfigured ? "bg-yellow-500" : "bg-gray-400"}`} />
              <span className="font-semibold text-sm text-gray-800">Shopify</span>
            </div>
            <p className="text-xs text-gray-500">
              {meta.shopifyOk
                ? `Conectada — ${data.filter((c) => c.shopify).length} pedido(s) encontrado(s)`
                : meta.shopifyConfigured
                ? meta.shopifyError ?? "Erro desconhecido"
                : "Não configurada (SHOPIFY_STORE_URL / SHOPIFY_API_ACCESS_TOKEN)"}
            </p>
          </div>
        </div>
      )}

      {/* ── Busca ───────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por ID, cliente, email ou pedido…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* ── Loading ─────────────────────────────────────────── */}
      {loading && data.length === 0 && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-100 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-48" />
                  <div className="h-3 bg-gray-100 rounded w-64" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty ───────────────────────────────────────────── */}
      {!loading && filtered.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-xl py-20 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <p className="text-gray-500 font-medium">
            {data.length === 0 ? "Nenhum dado encontrado" : "Nenhum resultado para a busca"}
          </p>
          <p className="text-gray-400 text-sm mt-1">
            {data.length === 0 ? "Verifique se as APIs estão configuradas corretamente" : "Ajuste o termo de busca"}
          </p>
        </div>
      )}

      {/* ── Lista de chargebacks ────────────────────────────── */}
      <div className="space-y-3">
        {filtered.map((cb) => {
          const isOpen = expanded === cb.id;
          const customerName = cb.pagarme.customer?.name || cb.shopify?.customer?.name || "Desconhecido";
          const customerEmail = cb.pagarme.customer?.email || cb.shopify?.email || "";

          return (
            <div key={cb.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden transition-shadow hover:shadow-sm">
              {/* ── Row resumo ──────────────────────────────── */}
              <button
                onClick={() => toggle(cb.id)}
                className="w-full text-left p-4 flex items-center gap-4"
              >
                {/* Ícone de fonte de dados */}
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <span className="text-xs font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded">PM</span>
                  {cb.shopify && <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">SH</span>}
                </div>

                {/* Info principal */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">{customerName}</span>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                      {REASON_LABELS[cb.reason] ?? cb.reason}
                    </span>
                    {cb.shopify?.fulfillmentStatus && (
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${FULFILLMENT_LABELS[cb.shopify.fulfillmentStatus]?.cls ?? "bg-gray-100 text-gray-600"}`}>
                        {FULFILLMENT_LABELS[cb.shopify.fulfillmentStatus]?.label ?? cb.shopify.fulfillmentStatus}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 flex-wrap">
                    {customerEmail && <span>{customerEmail}</span>}
                    {cb.orderId && (
                      <>
                        <span>·</span>
                        <span>Pedido #{cb.orderId}</span>
                      </>
                    )}
                    {cb.shopify?.orderName && (
                      <>
                        <span>·</span>
                        <span className="text-emerald-600 font-medium">Shopify {cb.shopify.orderName}</span>
                      </>
                    )}
                    <span>·</span>
                    <span>{formatDate(cb.createdAt)}</span>
                  </div>
                </div>

                {/* Valor */}
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-red-600">{formatCurrency(cb.amount)}</p>
                  {cb.shopify?.totalPrice && (
                    <p className="text-xs text-gray-400">
                      Shopify: {formatCurrency(parseFloat(cb.shopify.totalPrice), cb.shopify.currency)}
                    </p>
                  )}
                </div>

                {/* Chevron */}
                <svg className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* ── Detalhe expandido ──────────────────────── */}
              {isOpen && (
                <div className="border-t border-gray-100 px-4 pb-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-5">

                    {/* ──── Coluna Pagar.me ──────────────────── */}
                    <div>
                      <h3 className="text-sm font-bold text-violet-700 flex items-center gap-1.5 mb-3">
                        <span className="w-2 h-2 bg-violet-500 rounded-full" />
                        Pagar.me
                      </h3>

                      <div className="space-y-3 text-sm">
                        {/* Charge */}
                        <Section title="Identificação">
                          <Row label="Charge ID" value={cb.chargeId} mono />
                          <Row label="Status" value={cb.status} />
                          <Row label="Motivo" value={REASON_LABELS[cb.reason] ?? cb.reason} />
                          <Row label="Valor" value={formatCurrency(cb.amount)} />
                          <Row label="Criado em" value={formatDate(cb.createdAt)} />
                        </Section>

                        {/* Cliente */}
                        {cb.pagarme.customer && (
                          <Section title="Cliente">
                            <Row label="Nome" value={cb.pagarme.customer.name} />
                            <Row label="Email" value={cb.pagarme.customer.email} />
                            <Row label="CPF/CNPJ" value={cb.pagarme.customer.documentNumber} />
                            <Row label="Telefone" value={cb.pagarme.customer.phoneNumber} />
                          </Section>
                        )}

                        {/* Pedido */}
                        {cb.orderId && (
                          <Section title="Pedido">
                            <Row label="Order ID" value={cb.orderId} mono />
                            <Row label="Status" value={cb.pagarme.orderStatus} />
                            {cb.pagarme.orderAmount && <Row label="Valor Pedido" value={formatCurrency(cb.pagarme.orderAmount)} />}
                            <Row label="Cobranças" value={String(cb.pagarme.chargesCount)} />
                            {cb.pagarme.closedAt && <Row label="Fechado em" value={formatDate(cb.pagarme.closedAt)} />}
                          </Section>
                        )}

                        {/* Endereços */}
                        {(cb.pagarme.billingAddress || cb.pagarme.shippingAddress) && (
                          <Section title="Endereços">
                            <Row label="Cobrança" value={formatAddress(cb.pagarme.billingAddress)} />
                            <Row label="Entrega" value={formatAddress(cb.pagarme.shippingAddress)} />
                          </Section>
                        )}

                        {/* Itens */}
                        {cb.pagarme.items.length > 0 && (
                          <Section title={`Itens (${cb.pagarme.items.length})`}>
                            <div className="space-y-1">
                              {cb.pagarme.items.map((item, i) => (
                                <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                                  <span className="text-gray-700">{item.description} <span className="text-gray-400">×{item.quantity}</span></span>
                                  <span className="text-gray-600 font-medium">{formatCurrency(item.amount / 100)}</span>
                                </div>
                              ))}
                            </div>
                          </Section>
                        )}

                        {/* Metadata */}
                        {cb.pagarme.metadata && Object.keys(cb.pagarme.metadata).length > 0 && (
                          <Section title="Metadata">
                            <pre className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 overflow-auto max-h-40">
                              {JSON.stringify(cb.pagarme.metadata, null, 2)}
                            </pre>
                          </Section>
                        )}
                      </div>
                    </div>

                    {/* ──── Coluna Shopify ───────────────────── */}
                    <div>
                      <h3 className="text-sm font-bold text-emerald-700 flex items-center gap-1.5 mb-3">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                        Shopify
                      </h3>

                      {!cb.shopify ? (
                        <div className="bg-gray-50 rounded-xl p-5">
                          <p className="text-gray-500 text-sm font-medium mb-2">Pedido não encontrado na Shopify</p>
                          {cb._matchDebug && (
                            <div className="space-y-2 text-xs">
                              <div className="flex items-start gap-2">
                                <span className="text-gray-400 w-28 flex-shrink-0">Order ID (PM)</span>
                                <span className="text-gray-600 font-mono">{cb._matchDebug.pagarmeOrderId ?? "—"}</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="text-gray-400 w-28 flex-shrink-0">Email cliente</span>
                                <span className="text-gray-600">{cb._matchDebug.customerEmail ?? "—"}</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="text-gray-400 w-28 flex-shrink-0">Metadata keys</span>
                                <span className="text-gray-600 font-mono">
                                  {cb._matchDebug.metadataKeys.length > 0 ? cb._matchDebug.metadataKeys.join(", ") : "vazio"}
                                </span>
                              </div>
                              <div className="mt-2 pt-2 border-t border-gray-200">
                                <p className="text-gray-400 font-semibold mb-1">Tentativas de correspondência:</p>
                                {cb._matchDebug.attempts.length > 0 ? (
                                  <ul className="space-y-1">
                                    {cb._matchDebug.attempts.map((a, i) => (
                                      <li key={i} className="text-gray-500 flex items-start gap-1.5">
                                        <span className="text-red-400 mt-0.5">✗</span>
                                        <span>{a}</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-gray-400">Nenhuma tentativa (API não configurada ou sem dados para buscar)</p>
                                )}
                              </div>
                              <p className="text-gray-400 mt-2 pt-2 border-t border-gray-200">
                                💡 Para vincular automaticamente, o email do cliente no Pagar.me deve corresponder ao da Shopify,
                                ou o metadata da order no Pagar.me deve conter o nº do pedido Shopify
                                (ex: <code className="bg-gray-100 px-1 rounded">order_number</code>, <code className="bg-gray-100 px-1 rounded">pedido</code>).
                              </p>
                            </div>
                          )}

                          {/* Busca manual */}
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <p className="text-xs font-semibold text-gray-500 mb-2">Buscar manualmente na Shopify:</p>
                            {manualSearch?.cbId === cb.id ? (
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  placeholder="Nº do pedido (ex: 1001)"
                                  value={manualSearch.query}
                                  onChange={(e) => setManualSearch({ cbId: cb.id, query: e.target.value })}
                                  onKeyDown={(e) => e.key === "Enter" && handleManualShopifySearch(cb.id, manualSearch.query)}
                                  className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleManualShopifySearch(cb.id, manualSearch.query)}
                                  disabled={manualLoading}
                                  className="text-xs bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
                                >
                                  {manualLoading ? "…" : "Buscar"}
                                </button>
                                <button
                                  onClick={() => setManualSearch(null)}
                                  className="text-xs text-gray-400 hover:text-gray-600 px-2"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setManualSearch({ cbId: cb.id, query: "" })}
                                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                Buscar pedido por número
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3 text-sm">
                          {/* Pedido */}
                          <Section title="Pedido">
                            <Row label="Pedido" value={cb.shopify.orderName} />
                            <Row label="Email" value={cb.shopify.email} />
                            <Row label="Valor Total" value={formatCurrency(parseFloat(cb.shopify.totalPrice), cb.shopify.currency)} />
                            {cb.shopify.financialStatus && (
                              <Row label="Pagamento">
                                <span className={`text-xs px-2 py-0.5 rounded font-medium ${FINANCIAL_LABELS[cb.shopify.financialStatus]?.cls ?? "bg-gray-100 text-gray-600"}`}>
                                  {FINANCIAL_LABELS[cb.shopify.financialStatus]?.label ?? cb.shopify.financialStatus}
                                </span>
                              </Row>
                            )}
                            {cb.shopify.fulfillmentStatus && (
                              <Row label="Fulfillment">
                                <span className={`text-xs px-2 py-0.5 rounded font-medium ${FULFILLMENT_LABELS[cb.shopify.fulfillmentStatus]?.cls ?? "bg-gray-100 text-gray-600"}`}>
                                  {FULFILLMENT_LABELS[cb.shopify.fulfillmentStatus]?.label ?? cb.shopify.fulfillmentStatus}
                                </span>
                              </Row>
                            )}
                            {cb.shopify.tags.length > 0 && (
                              <Row label="Tags">
                                <div className="flex flex-wrap gap-1">
                                  {cb.shopify.tags.map((tag, i) => (
                                    <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{tag}</span>
                                  ))}
                                </div>
                              </Row>
                            )}
                          </Section>

                          {/* Cliente Shopify */}
                          {cb.shopify.customer && (
                            <Section title="Cliente">
                              <Row label="Nome" value={cb.shopify.customer.name} />
                              <Row label="Email" value={cb.shopify.customer.email} />
                              <Row label="Telefone" value={cb.shopify.customer.phone} />
                              <Row label="Endereço" value={formatAddress(cb.shopify.customer.address)} />
                            </Section>
                          )}

                          {/* Fulfillments */}
                          {cb.shopify.fulfillments.length > 0 && (
                            <Section title={`Rastreio (${cb.shopify.fulfillments.length})`}>
                              {cb.shopify.fulfillments.map((f, i) => (
                                <div key={i} className="bg-gray-50 rounded-lg p-3 space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${FULFILLMENT_LABELS[f.status]?.cls ?? "bg-gray-100 text-gray-600"}`}>
                                      {FULFILLMENT_LABELS[f.status]?.label ?? f.status}
                                    </span>
                                    <span className="text-xs text-gray-400">{formatDate(f.createdAt)}</span>
                                  </div>
                                  {f.tracking && (
                                    <div className="text-xs text-gray-600 space-y-0.5">
                                      {f.tracking.company && <p>Transportadora: <span className="font-medium">{f.tracking.company}</span></p>}
                                      {f.tracking.number && (
                                        <p>
                                          Código:{" "}
                                          {f.tracking.url ? (
                                            <a href={f.tracking.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-mono">
                                              {f.tracking.number}
                                            </a>
                                          ) : (
                                            <span className="font-mono">{f.tracking.number}</span>
                                          )}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </Section>
                          )}

                          {/* Itens Shopify */}
                          {cb.shopify.lineItems.length > 0 && (
                            <Section title={`Itens (${cb.shopify.lineItems.length})`}>
                              <div className="space-y-1">
                                {cb.shopify.lineItems.map((item, i) => (
                                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                                    <div>
                                      <span className="text-gray-700">{item.title} <span className="text-gray-400">×{item.quantity}</span></span>
                                      {item.sku && <span className="text-gray-300 text-xs ml-2">SKU: {item.sku}</span>}
                                    </div>
                                    <span className="text-gray-600 font-medium">R$ {item.price}</span>
                                  </div>
                                ))}
                              </div>
                            </Section>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Footer ──────────────────────────────────────────── */}
      {meta && (
        <p className="text-center text-xs text-gray-400">
          Dados obtidos às {new Date(meta.fetchedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          {" · "}{meta.total} chargeback{meta.total !== 1 ? "s" : ""}
          {" · "}Pagar.me {meta.pagarmeOk ? "✓" : "✗"}
          {" · "}Shopify {meta.shopifyOk ? "✓" : meta.shopifyConfigured ? "⚠" : "—"}
        </p>
      )}
    </div>
  );
}

/* ── Sub-componentes ────────────────────────────────────────────────────── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{title}</h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, value, mono, children }: { label: string; value?: string | null; mono?: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-gray-400 text-xs w-24 flex-shrink-0 pt-0.5">{label}</span>
      {children ?? <span className={`text-gray-700 text-sm ${mono ? "font-mono text-xs" : ""}`}>{value ?? "—"}</span>}
    </div>
  );
}
