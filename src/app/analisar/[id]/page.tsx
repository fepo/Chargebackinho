"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { salvarAutoSave } from "@/lib/storage";
import type { FormContestacao, TipoContestacao } from "@/types";

/* ══════════════════════════════════════════════════════════════════════════
   Tipos
═══════════════════════════════════════════════════════════════════════════ */
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
  rascunho?: FormContestacao;
  shopifyOrderName?: string;
  shopifyFulfillmentStatus?: string;
  shopifyTrackingNumber?: string;
  shopifyTrackingCompany?: string;
}

interface EnrichStep {
  name: string;
  status: "success" | "error" | "pending";
  message?: string;
}

interface EnrichResult {
  success: boolean;
  steps: EnrichStep[];
  shopifyOrder?: { name: string; fulfillmentStatus?: string };
  trackingCount: number;
  formData: FormContestacao;
  error?: string;
}

/* ══════════════════════════════════════════════════════════════════════════
   Checklist
═══════════════════════════════════════════════════════════════════════════ */
type ChecklistStatus = "obrigatorio" | "recomendado" | "opcional";
type ItemAvailability = "disponivel" | "ausente" | "verificar";

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  status: ChecklistStatus;
  availability: ItemAvailability;
  dica?: string;
}

function buildChecklist(
  tipo: TipoContestacao | null,
  form: FormContestacao | null,
  hasShopify: boolean
): ChecklistItem[] {
  const t = tipo ?? "desacordo_comercial";

  const hasTracking = !!(form?.codigoRastreio);
  const hasItems = !!(form?.itensPedido?.some((i) => i.descricao));
  const hasIP = !!(form?.ipComprador);
  const hasCommunications = (form?.comunicacoes?.length ?? 0) > 0;

  const all: Record<string, ChecklistItem> = {
    transacao: {
      id: "transacao",
      label: "Comprovação da transação",
      description: "NSU, código de autorização, dados do gateway e identificação única da cobrança.",
      status: "obrigatorio",
      availability: "disponivel",
    },
    nota_fiscal: {
      id: "nota_fiscal",
      label: "Nota fiscal / comprovante de venda",
      description: "NF-e ou cupom fiscal referente ao pedido; comprova a venda legítima.",
      status: "obrigatorio",
      availability: hasItems ? "disponivel" : "verificar",
      dica: hasItems ? undefined : "Adicione os itens do pedido no formulário para fortalecer esse ponto.",
    },
    entrega_rastreio: {
      id: "entrega_rastreio",
      label: "Comprovante de entrega e rastreio",
      description: "Código de rastreio, histórico de eventos e comprovante de entrega na transportadora.",
      status: t === "produto_nao_recebido" ? "obrigatorio" : "recomendado",
      availability: hasTracking ? "disponivel" : "ausente",
      dica: hasTracking ? undefined : "Preencha a transportadora e o código de rastreio no formulário.",
    },
    fulfillment: {
      id: "fulfillment",
      label: "Histórico do pedido e fulfillment",
      description: "Timeline completa do pedido: criação, separação, expedição e entrega.",
      status: t === "produto_nao_recebido" ? "obrigatorio" : "recomendado",
      availability: hasShopify ? "disponivel" : "verificar",
      dica: hasShopify ? undefined : "Vincule o pedido Shopify para obter o histórico completo automaticamente.",
    },
    comunicacoes: {
      id: "comunicacoes",
      label: "Logs de comunicação com o cliente",
      description: "E-mails, tickets de suporte, chats — registros que demonstram a relação comercial e atendimento prestado.",
      status: "recomendado",
      availability: hasCommunications ? "disponivel" : "ausente",
      dica: "Registre as comunicações relevantes na aba 'Entrega' do formulário.",
    },
    politica_reembolso: {
      id: "politica_reembolso",
      label: "Política de troca e reembolso vigente à época",
      description: "Captura da política publicada no site na data da compra. Demonstra que o cliente foi informado.",
      status: t === "desacordo_comercial" ? "obrigatorio" : "recomendado",
      availability: form?.politicaReembolsoUrl ? "disponivel" : "verificar",
      dica: "Informe a URL da política de reembolso no formulário.",
    },
    termos: {
      id: "termos",
      label: "Confirmação do aceite dos termos pelo cliente",
      description: "Print do checkout com checkbox de aceite, ou registro do aceite eletrônico dos termos de serviço.",
      status: t === "fraude" ? "obrigatorio" : "recomendado",
      availability: "verificar",
      dica: "Guarde evidência do aceite dos termos no momento do checkout.",
    },
    antifraude: {
      id: "antifraude",
      label: "Evidências antifraude (IP e dispositivo)",
      description: "IP do comprador, fingerprint do dispositivo, score antifraude da transação — conforme boas práticas jurídicas e regulatórias brasileiras para e-commerce.",
      status: t === "fraude" ? "obrigatorio" : t === "desacordo_comercial" ? "recomendado" : "opcional",
      availability: hasIP ? "disponivel" : t === "fraude" ? "ausente" : "verificar",
      dica: hasIP ? undefined : "Preencha o IP do comprador no formulário (campo 'Cliente').",
    },
    estorno: {
      id: "estorno",
      label: "Comprovante de estorno (se aplicável)",
      description: "Protocolo e comprovante de devolução ou crédito ao cliente, quando o estorno já foi realizado pelo lojista.",
      status: t === "credito_nao_processado" ? "obrigatorio" : "opcional",
      availability: "verificar",
      dica: "Aplique somente quando o estorno já foi processado pela sua loja.",
    },
  };

  // Ordem e itens por tipo de disputa
  const ORDER: Record<TipoContestacao, string[]> = {
    desacordo_comercial:    ["transacao", "nota_fiscal", "politica_reembolso", "entrega_rastreio", "comunicacoes", "termos", "fulfillment", "antifraude"],
    produto_nao_recebido:   ["transacao", "nota_fiscal", "entrega_rastreio", "fulfillment", "comunicacoes", "termos", "antifraude"],
    fraude:                 ["transacao", "antifraude", "termos", "nota_fiscal", "fulfillment", "entrega_rastreio", "comunicacoes"],
    credito_nao_processado: ["transacao", "estorno", "nota_fiscal", "fulfillment", "comunicacoes", "politica_reembolso"],
  };

  return (ORDER[t] ?? ORDER.desacordo_comercial).map((key) => all[key]);
}

/* ══════════════════════════════════════════════════════════════════════════
   Helpers de UI
═══════════════════════════════════════════════════════════════════════════ */
const STATUS_CLS: Record<ChecklistStatus, string> = {
  obrigatorio: "text-red-700 bg-red-50 border-red-200",
  recomendado: "text-amber-700 bg-amber-50 border-amber-200",
  opcional:    "text-gray-500 bg-gray-50 border-gray-200",
};

const STATUS_LABEL: Record<ChecklistStatus, string> = {
  obrigatorio: "Obrigatório",
  recomendado: "Recomendado",
  opcional:    "Opcional",
};

const AVAIL_ICON: Record<ItemAvailability, { icon: string; cls: string }> = {
  disponivel: { icon: "✓", cls: "bg-green-100 text-green-700 border-green-200" },
  ausente:    { icon: "✗", cls: "bg-red-100 text-red-600 border-red-200" },
  verificar:  { icon: "?", cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
};

const AVAIL_LABEL: Record<ItemAvailability, string> = {
  disponivel: "Disponível",
  ausente:    "Ausente",
  verificar:  "Verificar",
};

const TIPO_LABELS: Record<string, string> = {
  desacordo_comercial:    "Desacordo Comercial",
  produto_nao_recebido:   "Produto Não Recebido",
  fraude:                 "Fraude",
  credito_nao_processado: "Crédito Não Processado",
};

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

/* ══════════════════════════════════════════════════════════════════════════
   Componente principal
═══════════════════════════════════════════════════════════════════════════ */
export default function AnalisarPage() {
  const router = useRouter();
  const { id } = useParams();

  const [cb, setCb] = useState<ChargebackItem | null>(null);
  const [enriching, setEnriching] = useState(true);
  const [enrichResult, setEnrichResult] = useState<EnrichResult | null>(null);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [tipoSelecionado, setTipoSelecionado] = useState<TipoContestacao>("desacordo_comercial");
  const [iniciando, setIniciando] = useState(false);

  /* ── Carrega dados do sessionStorage ──────────────────────────────── */
  useEffect(() => {
    if (typeof id !== "string") return;
    const raw = sessionStorage.getItem(`cb_analyze_${id}`);
    if (raw) {
      try {
        const data: ChargebackItem = JSON.parse(raw);
        setCb(data);
      } catch { /* ignora */ }
    }
  }, [id]);

  /* ── Enriquece via /api/gerar-defesa ──────────────────────────────── */
  const enrich = useCallback(async (chargebackData: ChargebackItem) => {
    setEnriching(true);
    setEnrichError(null);
    try {
      const res = await fetch("/api/gerar-defesa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chargebackId: chargebackData.id,
          chargeId: chargebackData.chargeId,
          orderId: chargebackData.orderId || chargebackData.rascunho?.numeroPedido,
          customerName: chargebackData.customerName,
          customerEmail: chargebackData.customerEmail,
          amount: chargebackData.amount,
          reason: chargebackData.reason,
          rascunho: chargebackData.rascunho,
        }),
      });
      const data: EnrichResult = await res.json();
      if (data.success) {
        setEnrichResult(data);
        // Detecta tipo de disputa a partir do formData enriquecido
        if (data.formData?.tipoContestacao) {
          setTipoSelecionado(data.formData.tipoContestacao);
        }
      } else {
        setEnrichError(data.error ?? "Erro ao enriquecer dados");
      }
    } catch (e) {
      setEnrichError(e instanceof Error ? e.message : "Erro de conexão");
    } finally {
      setEnriching(false);
    }
  }, []);

  useEffect(() => {
    if (cb) enrich(cb);
  }, [cb, enrich]);

  /* ── Inicia a contestação ─────────────────────────────────────────── */
  const handleIniciarContestacao = () => {
    if (!enrichResult?.formData) return;
    setIniciando(true);
    const form: FormContestacao = {
      ...enrichResult.formData,
      tipoContestacao: tipoSelecionado,
    };
    salvarAutoSave(form);
    router.push("/");
  };

  /* ── Checklist ────────────────────────────────────────────────────── */
  const checklist = buildChecklist(
    tipoSelecionado,
    enrichResult?.formData ?? null,
    !!(cb?.shopifyOrderName || enrichResult?.shopifyOrder)
  );

  const disponivel  = checklist.filter((i) => i.availability === "disponivel").length;
  const obrigatoriosOk = checklist
    .filter((i) => i.status === "obrigatorio")
    .every((i) => i.availability === "disponivel");

  /* ══════════════════════════════════════════════════════════════════════
     Render
  ═══════════════════════════════════════════════════════════════════════ */

  // Sem dados no sessionStorage
  if (!cb && !enriching) {
    return (
      <div className="space-y-6">
        <div className="text-center py-20 bg-white border border-gray-200 rounded-xl">
          <p className="text-gray-500 font-medium mb-2">Dados do chargeback não encontrados</p>
          <p className="text-gray-400 text-sm mb-6">Selecione um chargeback no dashboard para analisar.</p>
          <Link href="/" className="text-brand-600 hover:text-brand-700 font-medium text-sm">← Voltar ao dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Análise de Chargeback</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {cb?.customerName && <span>{cb.customerName} · </span>}
            {cb?.amount && <span>{formatCurrency(cb.amount)} em disputa</span>}
          </p>
        </div>
        <Link href="/" className="text-sm text-gray-600 hover:text-gray-900 font-medium">← Dashboard</Link>
      </div>

      {/* ── Dados enriquecidos / loading ────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Fontes de dados */}
        <div className="md:col-span-2 bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Dados coletados</h2>

          {/* Loading skeleton */}
          {enriching && (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-gray-100 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 bg-gray-100 rounded w-32" />
                    <div className="h-2 bg-gray-100 rounded w-48" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Steps de enriquecimento */}
          {!enriching && enrichResult && (
            <div className="space-y-2">
              {enrichResult.steps.map((s, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold border ${
                    s.status === "success" ? "bg-green-100 text-green-700 border-green-200"
                    : s.status === "error"   ? "bg-red-100 text-red-600 border-red-200"
                    : "bg-gray-100 text-gray-400 border-gray-200"
                  }`}>
                    {s.status === "success" ? "✓" : s.status === "error" ? "✗" : "—"}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{s.name}</p>
                    {s.message && <p className="text-xs text-gray-400">{s.message}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Erro de enriquecimento */}
          {!enriching && enrichError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{enrichError}</p>
              <button
                onClick={() => cb && enrich(cb)}
                className="mt-2 text-xs text-red-600 hover:text-red-800 font-medium"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {/* Resumo dos dados disponíveis */}
          {!enriching && enrichResult && (
            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3 text-sm">
              {cb?.customerName && (
                <div>
                  <span className="text-xs text-gray-400">Cliente</span>
                  <p className="font-medium text-gray-900 truncate">{cb.customerName}</p>
                </div>
              )}
              {cb?.customerEmail && (
                <div>
                  <span className="text-xs text-gray-400">Email</span>
                  <p className="font-medium text-gray-900 truncate">{cb.customerEmail}</p>
                </div>
              )}
              {cb?.amount && (
                <div>
                  <span className="text-xs text-gray-400">Valor</span>
                  <p className="font-bold text-red-600">{formatCurrency(cb.amount)}</p>
                </div>
              )}
              {enrichResult.shopifyOrder && (
                <div>
                  <span className="text-xs text-gray-400">Pedido Shopify</span>
                  <p className="font-medium text-emerald-700">{enrichResult.shopifyOrder.name}</p>
                </div>
              )}
              {enrichResult.trackingCount > 0 && (
                <div>
                  <span className="text-xs text-gray-400">Eventos de rastreio</span>
                  <p className="font-medium text-gray-900">{enrichResult.trackingCount} evento(s)</p>
                </div>
              )}
              {enrichResult.formData?.codigoRastreio && (
                <div>
                  <span className="text-xs text-gray-400">Código de rastreio</span>
                  <p className="font-mono text-gray-900 text-xs">{enrichResult.formData.codigoRastreio}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Seletor de tipo de disputa */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Tipo de disputa</h2>
          <p className="text-xs text-gray-400 mb-4">
            O checklist e os documentos obrigatórios variam conforme o tipo. Confirme o tipo antes de prosseguir.
          </p>
          <div className="space-y-2">
            {(["desacordo_comercial", "produto_nao_recebido", "fraude", "credito_nao_processado"] as TipoContestacao[]).map((t) => (
              <button
                key={t}
                onClick={() => setTipoSelecionado(t)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  tipoSelecionado === t
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {TIPO_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Checklist jurídico-prático ──────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">
              Checklist — {TIPO_LABELS[tipoSelecionado]}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Conforme boas práticas jurídicas e regulatórias brasileiras para e-commerce.
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-gray-900">{disponivel}/{checklist.length}</p>
            <p className="text-xs text-gray-400">itens disponíveis</p>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {checklist.map((item) => {
            const avail = AVAIL_ICON[item.availability];
            return (
              <div key={item.id} className="px-5 py-4 flex items-start gap-4">
                {/* Ícone de disponibilidade */}
                <span className={`flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold mt-0.5 ${avail.cls}`}>
                  {avail.icon}
                </span>

                {/* Conteúdo */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900">{item.label}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${STATUS_CLS[item.status]}`}>
                      {STATUS_LABEL[item.status]}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${avail.cls}`}>
                      {AVAIL_LABEL[item.availability]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                  {item.dica && item.availability !== "disponivel" && (
                    <p className="text-xs text-blue-600 mt-1 flex items-start gap-1">
                      <span className="flex-shrink-0">💡</span>
                      {item.dica}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Alerta de itens obrigatórios ausentes */}
        {!enriching && !obrigatoriosOk && (
          <div className="px-5 py-4 bg-amber-50 border-t border-amber-200">
            <p className="text-sm text-amber-800 font-medium">
              Atenção: há itens obrigatórios ausentes ou a verificar.
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Você pode prosseguir mesmo assim — adicione os dados no formulário de contestação ou anexe os documentos diretamente na submissão.
            </p>
          </div>
        )}
      </div>

      {/* ── Rodapé de ação ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-200">
        <Link href="/" className="btn-secondary text-sm">← Voltar</Link>

        <div className="flex items-center gap-3">
          {!enriching && !obrigatoriosOk && (
            <p className="text-xs text-amber-700 font-medium">
              Itens obrigatórios pendentes — verifique o checklist
            </p>
          )}
          <button
            onClick={handleIniciarContestacao}
            disabled={enriching || iniciando || !enrichResult}
            className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-all shadow-sm hover:shadow-md disabled:opacity-50"
          >
            {iniciando ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Preparando…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Iniciar Contestação
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
