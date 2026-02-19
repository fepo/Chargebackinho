"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  listarRascunhos,
  deletarRascunho,
  duplicarRascunho,
  formatarDataRascunho,
  type Rascunho,
} from "@/lib/storage";

type StatusType = "rascunho" | "gerada" | "exportada" | "enviada" | "ganha" | "perdida";
type TipoContestacaoType = "desacordo_comercial" | "produto_nao_recebido" | "fraude" | "credito_nao_processado";

const TIPO_LABELS: Record<TipoContestacaoType, string> = {
  desacordo_comercial: "Desacordo",
  produto_nao_recebido: "Não Recebido",
  fraude: "Fraude",
  credito_nao_processado: "Crédito",
};

const STATUS_COLORS: Record<StatusType, string> = {
  rascunho: "bg-gray-100 text-gray-700",
  gerada: "bg-blue-100 text-blue-700",
  exportada: "bg-green-100 text-green-700",
  enviada: "bg-purple-100 text-purple-700",
  ganha: "bg-emerald-100 text-emerald-700",
  perdida: "bg-red-100 text-red-700",
};

export default function HistoricoPage() {
  const [rascunhos, setRascunhos] = useState<Rascunho[]>([]);
  const [filtros, setFiltros] = useState({
    tipo: "",
    dataInicio: "",
    dataFim: "",
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setRascunhos(listarRascunhos());
    setMounted(true);
  }, []);

  const deletarRascunhoLocal = (id: string) => {
    deletarRascunho(id);
    setRascunhos(listarRascunhos());
  };

  const duplicarRascunhoLocal = (id: string) => {
    duplicarRascunho(id);
    setRascunhos(listarRascunhos());
  };

  const retomarRascunho = (id: string) => {
    // Salva ID do rascunho a retomar
    localStorage.setItem("rascunho_to_resume", id);
    window.location.href = "/";
  };

  // Filtra rascunhos
  const rascunhosFiltrados = rascunhos.filter((r) => {
    if (filtros.tipo && r.formulario.tipoContestacao !== filtros.tipo) {
      return false;
    }

    if (filtros.dataInicio) {
      const dataInicio = new Date(filtros.dataInicio);
      const dataRascunho = new Date(r.data);
      if (dataRascunho < dataInicio) return false;
    }

    if (filtros.dataFim) {
      const dataFim = new Date(filtros.dataFim);
      const dataRascunho = new Date(r.data);
      if (dataRascunho > dataFim) return false;
    }

    return true;
  });

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Carregando...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Histórico</h1>
          <Link href="/" className="btn-primary">
            ← Voltar
          </Link>
        </div>

        {/* Filtros */}
        <div className="card p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Filtros</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Tipo de Contestação</label>
              <select
                className="input"
                value={filtros.tipo}
                onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}
              >
                <option value="">Todos os tipos</option>
                <option value="desacordo_comercial">Desacordo Comercial</option>
                <option value="produto_nao_recebido">Produto Não Recebido</option>
                <option value="fraude">Fraude</option>
                <option value="credito_nao_processado">Crédito Não Processado</option>
              </select>
            </div>

            <div>
              <label className="label">Data de Início</label>
              <input
                type="date"
                className="input"
                value={filtros.dataInicio}
                onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Data de Fim</label>
              <input
                type="date"
                className="input"
                value={filtros.dataFim}
                onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setFiltros({ tipo: "", dataInicio: "", dataFim: "" })}
            className="mt-4 text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            Limpar filtros
          </button>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="card p-4">
            <div className="text-sm text-gray-600">Total</div>
            <div className="text-2xl font-bold text-gray-900">{rascunhos.length}</div>
          </div>

          <div className="card p-4">
            <div className="text-sm text-gray-600">Filtrados</div>
            <div className="text-2xl font-bold text-brand-600">{rascunhosFiltrados.length}</div>
          </div>

          <div className="card p-4">
            <div className="text-sm text-gray-600">Tokens Totais</div>
            <div className="text-2xl font-bold text-gray-900">
              {rascunhos.reduce((sum, r) => sum + r.gastoTokensEstimado, 0).toLocaleString()}
            </div>
          </div>

          <div className="card p-4">
            <div className="text-sm text-gray-600">Média/Rascunho</div>
            <div className="text-2xl font-bold text-gray-900">
              {rascunhos.length > 0
                ? Math.round(rascunhos.reduce((sum, r) => sum + r.gastoTokensEstimado, 0) / rascunhos.length)
                : 0}
            </div>
          </div>
        </div>
      </div>

      {/* Tabela */}
      {rascunhosFiltrados.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-500 text-lg mb-4">Nenhum rascunho encontrado.</p>
          <Link href="/" className="btn-primary inline-block">
            Criar nova contestação
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Título
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Valor
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Tokens
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rascunhosFiltrados.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="font-medium">{r.titulo}</div>
                      <div className="text-xs text-gray-500 mt-1 font-mono">{r.id}</div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className="inline-block bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium">
                        {TIPO_LABELS[r.formulario.tipoContestacao as TipoContestacaoType]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <span className="font-medium">R$ {r.formulario.valorTransacao}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      ~{r.gastoTokensEstimado} tokens
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatarDataRascunho(r.data)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                          STATUS_COLORS["rascunho"]
                        }`}
                      >
                        Rascunho
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => retomarRascunho(r.id)}
                          className="text-brand-600 hover:text-brand-700 font-medium text-xs"
                        >
                          Retomar
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicarRascunhoLocal(r.id)}
                          className="text-gray-600 hover:text-gray-700 font-medium text-xs"
                        >
                          Duplicar
                        </button>
                        <button
                          type="button"
                          onClick={() => deletarRascunhoLocal(r.id)}
                          className="text-red-600 hover:text-red-700 font-medium text-xs"
                        >
                          Deletar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
