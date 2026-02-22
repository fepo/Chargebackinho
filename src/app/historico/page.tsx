"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type TipoContestacao = "desacordo_comercial" | "produto_nao_recebido" | "fraude" | "credito_nao_processado";

const TIPO_LABELS: Record<string, string> = {
  desacordo_comercial: "Desacordo",
  produto_nao_recebido: "Não Recebido",
  fraude: "Fraude",
  credito_nao_processado: "Crédito",
};

const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-orange-100 text-orange-700",
  defending: "bg-blue-100 text-blue-700",
  won:       "bg-emerald-100 text-emerald-700",
  lost:      "bg-red-100 text-red-700",
  closed:    "bg-gray-100 text-gray-700",
};

interface DefesaResumida {
  id: string;
  status: string;
  createdAt: string;
}

interface Chargeback {
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
  emailCliente: string | null;
  cpfCliente: string | null;
  enderecoEntrega: string | null;
  transportadora: string | null;
  codigoRastreio: string | null;
  createdAt: string;
  defesas: DefesaResumida[];
}

export default function HistoricoPage() {
  const [chargebacks, setChargebacks] = useState<Chargeback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({ tipo: "", status: "", dataInicio: "", dataFim: "" });

  useEffect(() => {
    fetch("/api/pagarme/chargebacks")
      .then((r) => r.json())
      .then((data) => {
        setChargebacks(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtrados = chargebacks.filter((cb) => {
    if (filtros.tipo && cb.tipoContestacao !== filtros.tipo) return false;
    if (filtros.status && cb.status !== filtros.status) return false;
    if (filtros.dataInicio && new Date(cb.createdAt) < new Date(filtros.dataInicio)) return false;
    if (filtros.dataFim && new Date(cb.createdAt) > new Date(filtros.dataFim)) return false;
    return true;
  });

  const totalValor = filtrados.reduce((sum, cb) => sum + parseFloat(cb.valorTransacao ?? "0"), 0);

  if (loading) return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">📊 Histórico de Chargebacks</h1>
        <Link href="/" className="btn-primary">← Voltar</Link>
      </div>

      {/* Filtros */}
      <div className="card p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Filtros</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="label">Tipo</label>
            <select className="input" value={filtros.tipo} onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}>
              <option value="">Todos</option>
              <option value="desacordo_comercial">Desacordo Comercial</option>
              <option value="produto_nao_recebido">Produto Não Recebido</option>
              <option value="fraude">Fraude</option>
              <option value="credito_nao_processado">Crédito Não Processado</option>
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={filtros.status} onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}>
              <option value="">Todos</option>
              <option value="pending">Pendente</option>
              <option value="defending">Em Defesa</option>
              <option value="won">Ganho</option>
              <option value="lost">Perdido</option>
              <option value="closed">Fechado</option>
            </select>
          </div>
          <div>
            <label className="label">Data início</label>
            <input type="date" className="input" value={filtros.dataInicio} onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })} />
          </div>
          <div>
            <label className="label">Data fim</label>
            <input type="date" className="input" value={filtros.dataFim} onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })} />
          </div>
        </div>
        <button type="button" onClick={() => setFiltros({ tipo: "", status: "", dataInicio: "", dataFim: "" })} className="mt-3 text-sm text-brand-600 hover:text-brand-700 font-medium">
          Limpar filtros
        </button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-sm text-gray-600">Total</div>
          <div className="text-2xl font-bold text-gray-900">{chargebacks.length}</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-gray-600">Filtrados</div>
          <div className="text-2xl font-bold text-brand-600">{filtrados.length}</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-gray-600">Valor total</div>
          <div className="text-2xl font-bold text-gray-900">R$ {totalValor.toFixed(2)}</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-gray-600">Com defesa</div>
          <div className="text-2xl font-bold text-green-600">
            {chargebacks.filter((cb) => cb.defesas?.length > 0).length}
          </div>
        </div>
      </div>

      {/* Tabela */}
      {filtrados.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-500 text-lg mb-4">Nenhum chargeback encontrado.</p>
          <p className="text-gray-400 text-sm">Os chargebacks aparecem aqui automaticamente ao receber webhooks da Pagar.me.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">ID / Pedido</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Cliente</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Tipo</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Valor</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Cartão</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Rastreio</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Defesas</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtrados.map((cb) => (
                  <tr key={cb.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs text-gray-500 truncate max-w-[120px]">{cb.externalId ?? cb.id}</div>
                      {cb.numeroPedido && <div className="text-xs font-medium text-gray-700 mt-0.5">{cb.numeroPedido}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{cb.nomeCliente ?? "—"}</div>
                      <div className="text-xs text-gray-500">{cb.emailCliente ?? ""}</div>
                      {cb.cpfCliente && <div className="text-xs text-gray-400">{cb.cpfCliente}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">
                        {TIPO_LABELS[cb.tipoContestacao ?? ""] ?? cb.tipoContestacao ?? "—"}
                      </span>
                      {cb.reason && <div className="text-xs text-gray-400 mt-1 max-w-[140px] truncate" title={cb.reason}>{cb.reason}</div>}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      R$ {cb.valorTransacao ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {cb.bandeira && <div className="capitalize">{cb.bandeira}</div>}
                      {cb.finalCartao && <div className="text-xs text-gray-400">•••• {cb.finalCartao}</div>}
                      {cb.dataTransacao && <div className="text-xs text-gray-400">{cb.dataTransacao}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {cb.codigoRastreio ? (
                        <div>
                          <div className="font-mono text-xs text-gray-700">{cb.codigoRastreio}</div>
                          {cb.transportadora && <div className="text-xs text-gray-400">{cb.transportadora}</div>}
                        </div>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[cb.status] ?? "bg-gray-100 text-gray-700"}`}>
                        {cb.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {cb.defesas?.length > 0 ? (
                        <div className="space-y-1">
                          {cb.defesas.map((d) => (
                            <Link key={d.id} href={`/defesas/${d.id}`} className="block text-xs text-brand-600 hover:underline font-mono">
                              {d.status} →
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <Link href="/" className="text-xs text-gray-400 hover:text-brand-600">+ criar</Link>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(cb.createdAt).toLocaleDateString("pt-BR")}
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

