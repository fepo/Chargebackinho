"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { listarRascunhos, obterRascunho, type Rascunho } from "@/lib/storage";

import type { FormContestacao } from "@/types";

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

export default function DefesasPage() {
  const router = useRouter();
  const [defesas, setDefesas] = useState<Defesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "n8n" | "manual">("all");
  const [mounted, setMounted] = useState(false);

  // ── Carregar defesas ao montar ──────────────────────
  useEffect(() => {
    const allRascunhos = listarRascunhos();
    const defesasList = allRascunhos.filter(
      (r) => (r.formulario as any)._defesaMeta !== undefined
    ) as Defesa[];


    setDefesas(defesasList);
    setMounted(true);
    setLoading(false);
  }, []);

  // ── Filtrar defesas ────────────────────────────────
  const getFilteredDefesas = () => {
    if (filter === "all") return defesas;
    return defesas.filter((d) => d.formulario._defesaMeta?.source === filter);
  };

  const filteredDefesas = getFilteredDefesas();

  // ── Badge de status ────────────────────────────────
  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "drafted":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            Rascunho
          </span>
        );
      case "submitted":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Enviado
          </span>
        );
      case "won":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Ganho
          </span>
        );
      case "lost":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            Perdido
          </span>
        );
      default:
        return null;
    }
  };

  // ── Badge de viabilidade ────────────────────────────
  const getViabilidadeBadge = (viabilidade?: number) => {
    if (!viabilidade) return null;
    const percentage = Math.round(viabilidade * 100);

    if (viabilidade >= 0.75) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-800">
          {percentage}% viável
        </span>
      );
    } else if (viabilidade >= 0.5) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-yellow-100 text-yellow-800">
          {percentage}% viável
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-800">
          {percentage}% viável
        </span>
      );
    }
  };

  // ── Badge de fonte ────────────────────────────────
  const getSourceBadge = (source?: string) => {
    if (source === "n8n") {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-purple-100 text-purple-800">
          🤖 n8n Auto
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-800">
        ✋ Manual
      </span>
    );
  };

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Carregando defesas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📋 Minhas Defesas</h1>
          <p className="text-gray-600 mt-1">
            Revise e aprove as defesas geradas para enviar à Pagar.me
          </p>
        </div>
        <Link
          href="/"
          className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium transition-colors"
        >
          ← Voltar
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === "all"
            ? "bg-brand-500 text-white"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
        >
          Todas ({defesas.length})
        </button>
        <button
          onClick={() => setFilter("n8n")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === "n8n"
            ? "bg-purple-500 text-white"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
        >
          🤖 Automáticas ({defesas.filter((d) => d.formulario._defesaMeta?.source === "n8n").length})
        </button>
        <button
          onClick={() => setFilter("manual")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === "manual"
            ? "bg-blue-500 text-white"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
        >
          ✋ Manuais ({defesas.filter((d) => d.formulario._defesaMeta?.source === "manual").length})
        </button>
      </div>

      {/* Lista de Defesas */}
      {filteredDefesas.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-600 mb-3">
            {filter === "all"
              ? "Nenhuma defesa encontrada."
              : `Nenhuma defesa ${filter === "n8n" ? "automática" : "manual"} encontrada.`}
          </p>
          <Link href="/" className="text-brand-600 hover:text-brand-700 font-medium">
            Criar nova contestação →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDefesas.map((defesa) => {
            const meta = defesa.formulario._defesaMeta;
            const parecer = meta?.parecer;

            return (
              <Link
                key={defesa.id}
                href={`/defesas/${defesa.id}`}
                className="block"
              >
                <div className="card p-4 hover:shadow-md hover:border-brand-200 transition cursor-pointer group">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-brand-600 transition">
                        {meta?.dossieTitulo || "Defesa sem título"}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Chargeback: <span className="font-mono text-gray-700">{meta?.chargebackId}</span>
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end">
                      {getStatusBadge(meta?.status)}
                      {getSourceBadge(meta?.source)}
                    </div>
                  </div>

                  {/* Parecer Info */}
                  {parecer && (
                    <div className="mb-3 pb-3 border-b border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          Tipo: {parecer.tipo.replace(/_/g, " ")}
                        </span>
                        <div className="flex gap-2">
                          {getViabilidadeBadge(parecer.viabilidade)}
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-indigo-100 text-indigo-800">
                            {Math.round(parecer.confianca * 100)}% confiança
                          </span>
                        </div>
                      </div>
                      <div
                        className={`px-3 py-2 rounded text-sm font-medium ${parecer.recomendacao === "responder"
                          ? "bg-green-50 text-green-800 border border-green-200"
                          : parecer.recomendacao === "nao_responder"
                            ? "bg-red-50 text-red-800 border border-red-200"
                            : "bg-yellow-50 text-yellow-800 border border-yellow-200"
                          }`}
                      >
                        Recomendação:{" "}
                        {parecer.recomendacao === "responder"
                          ? "✓ RESPONDER"
                          : parecer.recomendacao === "nao_responder"
                            ? "✗ NÃO RESPONDER"
                            : "⏳ ACOMPANHAR"}
                      </div>
                    </div>
                  )}

                  {/* Dados do Cliente */}
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>
                      Cliente: <span className="font-medium text-gray-800">{defesa.formulario.nomeCliente}</span>
                    </span>
                    <span className="text-xs text-gray-500">
                      Gerado em {new Date(meta?.geradoEm || "").toLocaleDateString("pt-BR")}
                    </span>
                  </div>

                  {/* CTA */}
                  <div className="mt-3 pt-3 border-t border-gray-100 text-brand-600 font-medium text-sm group-hover:text-brand-700 flex items-center gap-1">
                    Ver detalhes →
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
