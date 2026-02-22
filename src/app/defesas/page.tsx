"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Chargeback {
  id: string;
  externalId: string | null;
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
  createdAt: string;
}

interface Defesa {
  id: string;
  status: string;
  source: string;
  dossie: string;
  contestacao: string;
  parecerJuridico: string | null;
  pagarmeResponse: string | null;
  submittedAt: string | null;
  createdAt: string;
  chargeback: Chargeback;
}

export default function DefesasPage() {
  const [defesas, setDefesas] = useState<Defesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "n8n" | "manual">("all");

  useEffect(() => {
    fetch("/api/defesas")
      .then((r) => r.json())
      .then((data) => {
        setDefesas(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = filter === "all" ? defesas : defesas.filter((d) => d.source === filter);

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      drafted:   { label: "Rascunho",   cls: "bg-yellow-100 text-yellow-800" },
      approved:  { label: "Aprovado",   cls: "bg-blue-100 text-blue-800" },
      submitted: { label: "Enviado",    cls: "bg-indigo-100 text-indigo-800" },
      won:       { label: "✓ Ganho",    cls: "bg-green-100 text-green-800" },
      lost:      { label: "✗ Perdido",  cls: "bg-red-100 text-red-800" },
    };
    const s = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-700" };
    return <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${s.cls}`}>{s.label}</span>;
  };

  const getCbStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending:   "bg-orange-100 text-orange-800",
      defending: "bg-blue-100 text-blue-800",
      won:       "bg-green-100 text-green-800",
      lost:      "bg-red-100 text-red-800",
      closed:    "bg-gray-100 text-gray-700",
    };
    return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? "bg-gray-100 text-gray-700"}`}>{status}</span>;
  };

  const getTipoBadge = (tipo: string | null) => {
    const map: Record<string, string> = {
      produto_nao_recebido: "Não Recebido",
      fraude: "Fraude",
      credito_nao_processado: "Crédito",
      desacordo_comercial: "Desacordo",
    };
    return (
      <span className="inline-block bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">
        {map[tipo ?? ""] ?? tipo ?? "—"}
      </span>
    );
  };

  if (loading) {
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
          <p className="text-gray-600 mt-1">Revise e aprove as defesas para enviar à Pagar.me</p>
        </div>
        <Link href="/" className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium transition-colors">
          ← Voltar
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        {(["all", "n8n", "manual"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === f
                ? f === "n8n" ? "bg-purple-500 text-white" : f === "manual" ? "bg-blue-500 text-white" : "bg-brand-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {f === "all" && `Todas (${defesas.length})`}
            {f === "n8n" && `🤖 Automáticas (${defesas.filter(d => d.source === "n8n").length})`}
            {f === "manual" && `✋ Manuais (${defesas.filter(d => d.source === "manual").length})`}
          </button>
        ))}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-600 mb-3">Nenhuma defesa encontrada.</p>
          <Link href="/" className="text-brand-600 hover:text-brand-700 font-medium">
            Criar nova contestação →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((defesa) => {
            const cb = defesa.chargeback;
            return (
              <div key={defesa.id} className="card p-5 hover:shadow-md hover:border-brand-200 transition">
                {/* Linha 1: ID + badges */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm font-mono truncate">
                        {cb.externalId ?? cb.id}
                      </span>
                      {getTipoBadge(cb.tipoContestacao)}
                      {cb.bandeira && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{cb.bandeira} •••• {cb.finalCartao}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{cb.reason ?? "Chargeback"}</p>
                  </div>
                  <div className="flex gap-2 items-center ml-3 flex-shrink-0">
                    {getStatusBadge(defesa.status)}
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${defesa.source === "n8n" ? "bg-purple-100 text-purple-800" : "bg-gray-100 text-gray-800"}`}>
                      {defesa.source === "n8n" ? "🤖 n8n" : "✋ Manual"}
                    </span>
                  </div>
                </div>

                {/* Linha 2: dados do chargeback pertinentes */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-sm">
                  <div>
                    <span className="text-xs text-gray-500 block">Valor</span>
                    <span className="font-semibold text-gray-900">R$ {cb.valorTransacao ?? "—"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Cliente</span>
                    <span className="text-gray-800 truncate block">{cb.nomeCliente ?? "—"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Pedido</span>
                    <span className="text-gray-800 font-mono">{cb.numeroPedido || "—"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Data transação</span>
                    <span className="text-gray-800">{cb.dataTransacao ?? "—"}</span>
                  </div>
                </div>

                {/* Linha 3: entrega + rastreio */}
                {(cb.enderecoEntrega || cb.nomeCliente) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3 text-sm">
                    {cb.emailCliente && (
                      <div>
                        <span className="text-xs text-gray-500 block">Email</span>
                        <span className="text-gray-700">{cb.emailCliente}</span>
                      </div>
                    )}
                    {cb.enderecoEntrega && (
                      <div>
                        <span className="text-xs text-gray-500 block">Endereço entrega</span>
                        <span className="text-gray-700 text-xs">{cb.enderecoEntrega}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Linha 4: parecer jurídico */}
                {defesa.parecerJuridico && (
                  <div className="mb-3 p-3 bg-blue-50 rounded text-sm text-blue-800 border border-blue-100">
                    <span className="font-medium">Parecer: </span>{defesa.parecerJuridico}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs text-gray-500">
                  <span>Chargeback status: {getCbStatusBadge(cb.status)}</span>
                  <div className="flex items-center gap-4">
                    {defesa.submittedAt && (
                      <span>Enviado: {new Date(defesa.submittedAt).toLocaleDateString("pt-BR")}</span>
                    )}
                    <span>Gerado: {new Date(defesa.createdAt).toLocaleDateString("pt-BR")}</span>
                    <Link href={`/defesas/${defesa.id}`} className="text-brand-600 hover:text-brand-700 font-medium text-xs">
                      Ver detalhes →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

