"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { obterRascunho, type Rascunho } from "@/lib/storage";
import type { FormContestacao } from "@/types";
import { DossieViewer } from "@/app/components/DossieViewer";
import { ApprovalModal } from "@/app/components/ApprovalModal";

interface Defesa extends Rascunho {
  formulario: FormContestacao & {
    _defesaMeta?: {
      chargebackId: string;
      dossieTitulo: string;
      dossieMD: string;
      parecer?: {
        tipo: string;
        viabilidade: number;
        parecer: string;
        argumentos: string[];
        recomendacao: "responder" | "nao_responder" | "acompanhar";
        confianca: number;
      };
      shopifyData?: any;
      source: "n8n" | "manual";
      status: "drafted" | "submitted" | "won" | "lost";
      geradoEm: string;
      aprovarEm?: string;
    };
  };
}

export default function DefesaPage() {
  const router = useRouter();
  const { id } = useParams();
  const [defesa, setDefesa] = useState<Defesa | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approving, setApproving] = useState(false);

  // ── Carregar defesa ────────────────────────────────
  useEffect(() => {
    if (typeof id === "string") {
      const rascunho = obterRascunho(id) as Defesa | null;
      if (rascunho && rascunho.formulario._defesaMeta) {
        setDefesa(rascunho);
      }
      setMounted(true);
      setLoading(false);
    }
  }, [id]);

  // ── Handler para aprovar ───────────────────────────
  const handleApprove = async () => {
    if (!defesa) return;

    setApproving(true);
    try {
      const meta = defesa.formulario._defesaMeta!;

      const response = await fetch("/api/defesas/aprovar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defesaId: defesa.id,
          chargebackId: meta.chargebackId,
          dossieMD: meta.dossieMD,
          parecer: meta.parecer?.parecer || "Veja dossiê anexo",
          submitToPagarme: true,
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert(`✓ Defesa enviada com sucesso!\n\nReferência: ${result.chargebackId}`);
        setShowApprovalModal(false);
        router.push("/defesas");
      } else {
        alert(`Erro ao enviar: ${result.error}`);
      }
    } catch (error) {
      alert(`Erro ao enviar defesa: ${error instanceof Error ? error.message : "Erro desconhecido"}`);
    } finally {
      setApproving(false);
    }
  };

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Carregando defesa...</p>
      </div>
    );
  }

  if (!defesa) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <p className="text-red-600 mb-4">❌ Defesa não encontrada</p>
          <Link href="/defesas" className="text-brand-600 hover:text-brand-700 font-medium">
            ← Voltar para defesas
          </Link>
        </div>
      </div>
    );
  }

  const meta = defesa.formulario._defesaMeta!;
  const parecer = meta.parecer;
  const canApprove = meta.status === "drafted";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{meta.dossieTitulo}</h1>
          <p className="text-gray-600 mt-1">Chargeback: {meta.chargebackId}</p>
        </div>
        <Link href="/defesas" className="text-gray-600 hover:text-gray-900 font-medium">
          ← Voltar
        </Link>
      </div>

      {/* Status & Badges */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Status Badge */}
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
          <span className="w-2 h-2 rounded-full bg-yellow-500" />
          {meta.status === "drafted"
            ? "Rascunho - Aguardando Aprovação"
            : meta.status === "submitted"
              ? "Enviado para Pagar.me"
              : meta.status === "won"
                ? "Ganho"
                : "Perdido"}
        </span>

        {/* Fonte Badge */}
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
          {meta.source === "n8n" ? "🤖 Gerada Automaticamente" : "✋ Gerada Manualmente"}
        </span>

        {/* Data */}
        <span className="text-sm text-gray-600">
          Gerado em {new Date(meta.geradoEm).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      {/* Parecer Card (se existe) */}
      {parecer && (
        <div className="card p-6 border-l-4 border-l-blue-500 space-y-4">
          <h2 className="text-xl font-bold text-gray-900">📊 Parecer Jurídico</h2>

          <div className="grid grid-cols-3 gap-4">
            {/* Tipo */}
            <div>
              <p className="text-sm text-gray-600 mb-1">Tipo de Disputa</p>
              <p className="font-semibold text-gray-900 capitalize">
                {parecer.tipo.replace(/_/g, " ")}
              </p>
            </div>

            {/* Viabilidade */}
            <div>
              <p className="text-sm text-gray-600 mb-1">Viabilidade</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${parecer.viabilidade >= 0.75
                        ? "bg-green-500"
                        : parecer.viabilidade >= 0.5
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      }`}
                    style={{ width: `${parecer.viabilidade * 100}%` }}
                  />
                </div>
                <span className="font-semibold text-gray-900 w-12 text-right">
                  {Math.round(parecer.viabilidade * 100)}%
                </span>
              </div>
            </div>

            {/* Confiança */}
            <div>
              <p className="text-sm text-gray-600 mb-1">Confiança da IA</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-indigo-500 transition-all"
                    style={{ width: `${parecer.confianca * 100}%` }}
                  />
                </div>
                <span className="font-semibold text-gray-900 w-12 text-right">
                  {Math.round(parecer.confianca * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* Recomendação */}
          <div
            className={`p-4 rounded-lg font-medium text-lg ${parecer.recomendacao === "responder"
                ? "bg-green-50 text-green-900 border border-green-200"
                : parecer.recomendacao === "nao_responder"
                  ? "bg-red-50 text-red-900 border border-red-200"
                  : "bg-yellow-50 text-yellow-900 border border-yellow-200"
              }`}
          >
            {parecer.recomendacao === "responder"
              ? "✓ RECOMENDADO RESPONDER"
              : parecer.recomendacao === "nao_responder"
                ? "✗ NÃO RECOMENDADO RESPONDER"
                : "⏳ ACOMPANHAR SITUAÇÃO"}
          </div>

          {/* Argumentos */}
          {parecer.argumentos && parecer.argumentos.length > 0 && (
            <div>
              <p className="font-semibold text-gray-900 mb-3">Argumentos Principais</p>
              <ul className="space-y-2">
                {parecer.argumentos.map((arg, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="text-green-600 font-bold flex-shrink-0">✓</span>
                    <span className="text-gray-700">{arg}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Parecer Completo */}
          <div className="pt-4 border-t border-gray-200">
            <p className="font-semibold text-gray-900 mb-3">Parecer Completo</p>
            <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-700 whitespace-pre-wrap max-h-64 overflow-y-auto border border-gray-200">
              {parecer.parecer}
            </div>
          </div>
        </div>
      )}

      {/* Dossiê Viewer */}
      <DossieViewer markdown={meta.dossieMD} title={meta.dossieTitulo} />

      {/* Shopify Data (se existe) */}
      {meta.shopifyData && (
        <div className="card p-6 border-l-4 border-l-purple-500 space-y-4">
          <h2 className="text-xl font-bold text-gray-900">🛒 Dados Shopify Enriquecidos</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">ID do Pedido</p>
              <p className="font-semibold text-gray-900">{meta.shopifyData.orderId}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Status de Fulfillment</p>
              <p className="font-semibold text-gray-900 capitalize">
                {meta.shopifyData.fulfillmentStatus}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Status Financeiro</p>
              <p className="font-semibold text-gray-900 capitalize">
                {meta.shopifyData.financialStatus}
              </p>
            </div>
            {meta.shopifyData.trackingInfo && (
              <div>
                <p className="text-sm text-gray-600 mb-1">Rastreio</p>
                <p className="font-semibold text-gray-900">
                  {meta.shopifyData.trackingInfo.number}
                </p>
                <p className="text-xs text-gray-600">
                  {meta.shopifyData.trackingInfo.company}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dados Cliente */}
      <div className="card p-6 space-y-4">
        <h2 className="text-xl font-bold text-gray-900">👤 Dados do Cliente</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600 mb-1">Nome</p>
            <p className="font-semibold text-gray-900">{defesa.formulario.nomeCliente}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Email</p>
            <p className="font-semibold text-gray-900">{defesa.formulario.emailCliente}</p>
          </div>
          {defesa.formulario.cpfCliente && (
            <div>
              <p className="text-sm text-gray-600 mb-1">CPF</p>
              <p className="font-semibold text-gray-900">{defesa.formulario.cpfCliente}</p>
            </div>
          )}
          {defesa.formulario.ipComprador && (
            <div>
              <p className="text-sm text-gray-600 mb-1">IP do Comprador</p>
              <p className="font-semibold text-gray-900">{defesa.formulario.ipComprador}</p>
            </div>
          )}
        </div>

        {defesa.formulario.enderecoEntrega && (
          <div>
            <p className="text-sm text-gray-600 mb-1">Endereço de Entrega</p>
            <p className="text-gray-900">{defesa.formulario.enderecoEntrega}</p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-4 pt-6 border-t border-gray-200">
        <Link href="/defesas" className="btn-secondary">
          ← Voltar
        </Link>

        {canApprove && (
          <div className="flex gap-3">
            <button className="btn-secondary">
              👁️ Revisar Modificações
            </button>
            <button
              onClick={() => setShowApprovalModal(true)}
              disabled={approving}
              className="btn-primary flex items-center gap-2"
            >
              {approving ? (
                <>
                  <svg
                    className="animate-spin w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                  Enviando...
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                  </svg>
                  Enviar para Pagar.me
                </>
              )}
            </button>
          </div>
        )}

        {!canApprove && (
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">
              Esta defesa já foi {meta.status === "submitted" ? "enviada" : meta.status}.
            </p>
            <p className="text-xs text-gray-500">Você pode revisar o conteúdo acima.</p>
          </div>
        )}
      </div>

      {/* Approval Modal */}
      <ApprovalModal
        isOpen={showApprovalModal}
        defesaId={defesa.id}
        chargebackId={meta.chargebackId}
        onConfirm={handleApprove}
        onCancel={() => setShowApprovalModal(false)}
        isLoading={approving}
      />
    </div>
  );
}
