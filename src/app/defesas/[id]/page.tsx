"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { DossieViewer } from "@/app/components/DossieViewer";
import { ApprovalModal } from "@/app/components/ApprovalModal";

/* ── Tipos ────────────────────────────────────────────────────────────────── */
interface ChargebackDB {
  id: string;
  externalId: string | null;
  chargeId: string | null;
  gateway: string;
  status: string;
  reason: string | null;
  tipoContestacao: string | null;
  valorTransacao: string | null;
  bandeira: string | null;
  finalCartao: string | null;
  dataTransacao: string | null;
  numeroPedido: string | null;
  nomeCliente: string | null;
  cpfCliente: string | null;
  emailCliente: string | null;
  enderecoEntrega: string | null;
  transportadora: string | null;
  codigoRastreio: string | null;
  shopifyData: string | null;
  createdAt: string;
}

interface DefesaDB {
  id: string;
  chargebackId: string;
  dossie: string;
  contestacao: string;
  parecerJuridico: string | null;
  status: "drafted" | "approved" | "submitted" | "won" | "lost";
  source: string;
  pagarmeResponse: string | null;
  submittedAt: string | null;
  createdAt: string;
  chargeback: ChargebackDB;
}

/* ── Helpers de label ─────────────────────────────────────────────────────── */
const STATUS_LABELS: Record<string, { label: string; cls: string; dot: string }> = {
  drafted:   { label: "Rascunho — Aguardando Aprovação", cls: "bg-yellow-100 text-yellow-800", dot: "bg-yellow-500" },
  approved:  { label: "Aprovado",                        cls: "bg-blue-100 text-blue-800",    dot: "bg-blue-500" },
  submitted: { label: "Enviado para Pagar.me",           cls: "bg-indigo-100 text-indigo-800", dot: "bg-indigo-500" },
  won:       { label: "Ganho",                           cls: "bg-green-100 text-green-800",  dot: "bg-green-500" },
  lost:      { label: "Perdido",                         cls: "bg-red-100 text-red-800",      dot: "bg-red-500" },
};

const TIPO_LABELS: Record<string, string> = {
  desacordo_comercial:    "Desacordo Comercial",
  produto_nao_recebido:   "Produto Não Recebido",
  fraude:                 "Fraude",
  credito_nao_processado: "Crédito Não Processado",
};

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-900">{value}</p>
    </div>
  );
}

/* ── Componente ───────────────────────────────────────────────────────────── */
export default function DefesaPage() {
  const router = useRouter();
  const { id } = useParams();
  const [defesa, setDefesa] = useState<DefesaDB | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    if (typeof id !== "string") return;

    fetch(`/api/defesas/${id}`)
      .then(async (r) => {
        if (r.status === 404) { setNotFound(true); return; }
        if (!r.ok) throw new Error("Erro ao carregar defesa");
        const data: DefesaDB = await r.json();
        setDefesa(data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const handleApprove = async () => {
    if (!defesa) return;
    setApproving(true);
    try {
      const res = await fetch("/api/defesas/aprovar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defesaId: defesa.id,
          chargebackId: defesa.chargeback.externalId ?? defesa.chargebackId,
          dossieMD: defesa.dossie,
          parecer: defesa.parecerJuridico ?? "Veja dossiê anexo",
          submitToPagarme: true,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setDefesa((d) => d ? { ...d, status: "submitted" } : d);
        setShowApprovalModal(false);
        router.push("/defesas");
      } else {
        alert(`Erro ao enviar: ${result.error}`);
      }
    } catch (e) {
      alert(`Erro ao enviar defesa: ${e instanceof Error ? e.message : "Erro desconhecido"}`);
    } finally {
      setApproving(false);
    }
  };

  /* ── Loading ──────────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Carregando defesa…
        </div>
      </div>
    );
  }

  /* ── Not found ────────────────────────────────────────────────────────── */
  if (notFound || !defesa) {
    return (
      <div className="space-y-6">
        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-gray-700 font-medium mb-1">Defesa não encontrada</p>
          <p className="text-gray-400 text-sm mb-6">ID: {id}</p>
          <Link href="/defesas" className="text-brand-600 hover:text-brand-700 font-medium text-sm">
            ← Voltar para defesas
          </Link>
        </div>
      </div>
    );
  }

  const cb = defesa.chargeback;
  const statusInfo = STATUS_LABELS[defesa.status] ?? STATUS_LABELS.drafted;
  const canApprove = defesa.status === "drafted";

  // Tenta parsear shopifyData
  let shopify: Record<string, any> | null = null;
  try {
    if (cb.shopifyData) shopify = JSON.parse(cb.shopifyData);
  } catch { /* ignora */ }

  // Tenta parsear parecerJuridico como JSON (caso venha do n8n com objeto completo)
  let parecerObj: {
    tipo?: string; viabilidade?: number; confianca?: number;
    argumentos?: string[]; recomendacao?: string; parecer?: string;
  } | null = null;
  try {
    if (defesa.parecerJuridico) {
      const parsed = JSON.parse(defesa.parecerJuridico);
      if (typeof parsed === "object" && parsed !== null) parecerObj = parsed;
    }
  } catch { /* texto simples */ }

  const parecerText = parecerObj?.parecer ?? defesa.parecerJuridico ?? null;

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Defesa — {cb.nomeCliente ?? cb.externalId ?? defesa.id.slice(0, 12)}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {cb.externalId ?? defesa.chargebackId}
            {cb.tipoContestacao && ` · ${TIPO_LABELS[cb.tipoContestacao] ?? cb.tipoContestacao}`}
          </p>
        </div>
        <Link href="/defesas" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
          ← Voltar
        </Link>
      </div>

      {/* ── Badges de status ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${statusInfo.cls}`}>
          <span className={`w-2 h-2 rounded-full ${statusInfo.dot}`} />
          {statusInfo.label}
        </span>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
          defesa.source === "n8n" ? "bg-purple-100 text-purple-800" : "bg-gray-100 text-gray-700"
        }`}>
          {defesa.source === "n8n" ? "Automática (n8n)" : "Manual"}
        </span>
        <span className="text-xs text-gray-400">
          Gerado em {new Date(defesa.createdAt).toLocaleString("pt-BR", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          })}
        </span>
      </div>

      {/* ── Dados do Chargeback ─────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-4">Dados do Chargeback</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Valor" value={cb.valorTransacao ? `R$ ${cb.valorTransacao}` : null} />
          <Field label="Cliente" value={cb.nomeCliente} />
          <Field label="Email" value={cb.emailCliente} />
          <Field label="CPF" value={cb.cpfCliente} />
          <Field label="Pedido" value={cb.numeroPedido} />
          <Field label="Cartão" value={cb.bandeira ? `${cb.bandeira} •••• ${cb.finalCartao ?? ""}` : null} />
          <Field label="Transportadora" value={cb.transportadora} />
          <Field label="Rastreio" value={cb.codigoRastreio} />
        </div>
        {cb.enderecoEntrega && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <Field label="Endereço de entrega" value={cb.enderecoEntrega} />
          </div>
        )}
      </div>

      {/* ── Dados Shopify ──────────────────────────────────────────────── */}
      {shopify && (
        <div className="bg-white border border-emerald-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-emerald-700 mb-4 flex items-center gap-1.5">
            <span className="w-2 h-2 bg-emerald-500 rounded-full" />
            Dados Shopify Enriquecidos
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Pedido Shopify" value={shopify.orderName} />
            <Field label="Fulfillment" value={shopify.fulfillmentStatus} />
            <Field label="Pagamento" value={shopify.financialStatus} />
            {shopify.trackingInfo && (
              <Field label="Rastreio" value={shopify.trackingInfo.number} />
            )}
          </div>
        </div>
      )}

      {/* ── Parecer Jurídico ───────────────────────────────────────────── */}
      {(parecerObj || parecerText) && (
        <div className="bg-white border border-blue-200 rounded-xl p-5 border-l-4 border-l-blue-500">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Parecer Jurídico</h2>

          {parecerObj && (
            <div className="grid grid-cols-3 gap-4 mb-4">
              {parecerObj.viabilidade !== undefined && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Viabilidade</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${
                          parecerObj.viabilidade >= 0.75 ? "bg-green-500"
                          : parecerObj.viabilidade >= 0.5 ? "bg-yellow-500"
                          : "bg-red-500"
                        }`}
                        style={{ width: `${parecerObj.viabilidade * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                      {Math.round(parecerObj.viabilidade * 100)}%
                    </span>
                  </div>
                </div>
              )}
              {parecerObj.confianca !== undefined && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Confiança IA</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${parecerObj.confianca * 100}%` }} />
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                      {Math.round(parecerObj.confianca * 100)}%
                    </span>
                  </div>
                </div>
              )}
              {parecerObj.recomendacao && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Recomendação</p>
                  <span className={`inline-block text-xs px-2 py-1 rounded font-medium ${
                    parecerObj.recomendacao === "responder" ? "bg-green-100 text-green-800"
                    : parecerObj.recomendacao === "nao_responder" ? "bg-red-100 text-red-800"
                    : "bg-yellow-100 text-yellow-800"
                  }`}>
                    {parecerObj.recomendacao === "responder" ? "Responder"
                      : parecerObj.recomendacao === "nao_responder" ? "Não Responder"
                      : "Acompanhar"}
                  </span>
                </div>
              )}
            </div>
          )}

          {parecerObj?.argumentos && parecerObj.argumentos.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Argumentos</p>
              <ul className="space-y-1">
                {parecerObj.argumentos.map((arg: string, i: number) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-700">
                    <span className="text-green-500 flex-shrink-0 mt-0.5">✓</span>
                    {arg}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {parecerText && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap max-h-48 overflow-y-auto">
              {parecerText}
            </div>
          )}
        </div>
      )}

      {/* ── Dossiê ────────────────────────────────────────────────────── */}
      <DossieViewer markdown={defesa.dossie} title="Dossiê de Contestação" />

      {/* ── Ações ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 pt-4 border-t border-gray-200">
        <Link href="/defesas" className="btn-secondary">← Voltar</Link>

        {canApprove ? (
          <button
            onClick={() => setShowApprovalModal(true)}
            disabled={approving}
            className="btn-primary flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
            </svg>
            Enviar para Pagar.me
          </button>
        ) : (
          <p className="text-sm text-gray-500">
            Defesa {defesa.status === "submitted" ? "enviada" : defesa.status}.
            {defesa.submittedAt && ` Enviada em ${new Date(defesa.submittedAt).toLocaleDateString("pt-BR")}.`}
          </p>
        )}
      </div>

      <ApprovalModal
        isOpen={showApprovalModal}
        defesaId={defesa.id}
        chargebackId={defesa.chargeback.externalId ?? defesa.chargebackId}
        onConfirm={handleApprove}
        onCancel={() => setShowApprovalModal(false)}
        isLoading={approving}
      />
    </div>
  );
}
