"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type {
  FormContestacao,
  Gateway,
  TipoContestacao,
  ItemPedido,
  EventoRastreio,
  Comunicacao,
} from "@/types";
import {
  salvarAutoSave,
  carregarAutoSave,
  limparAutoSave,
  obterUltimoAutoSaveTime,
  listarRascunhos,
  obterRascunho,
  deletarRascunho,
  duplicarRascunho,
  formatarDataRascunho,
  type Rascunho,
} from "@/lib/storage";

const STEPS = [
  "Contestação",
  "Transação",
  "Pedido",
  "Cliente",
  "Entrega",
  "Empresa",
];

const emptyForm: FormContestacao = {
  gateway: "pagarme",
  contestacaoId: "",
  dataContestacao: "",
  tipoContestacao: "desacordo_comercial",
  valorTransacao: "",
  bandeira: "",
  finalCartao: "",
  dataTransacao: "",
  numeroPedido: "",
  itensPedido: [{ descricao: "", valor: "" }],
  codigoConfirmacao: "",
  nomeCliente: "",
  cpfCliente: "",
  emailCliente: "",
  enderecoEntrega: "",
  enderecoFaturamento: "",
  ipComprador: "",
  transportadora: "",
  codigoRastreio: "",
  eventosRastreio: [{ data: "", descricao: "" }],
  comunicacoes: [],
  nomeEmpresa: "",
  cnpjEmpresa: "",
  emailEmpresa: "",
  telefoneEmpresa: "",
  enderecoEmpresa: "",
  politicaReembolsoUrl: "",
};

export default function HomePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormContestacao>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [autoSaveTime, setAutoSaveTime] = useState<string | null>(null);
  const [showRascunhos, setShowRascunhos] = useState(false);
  const [rascunhos, setRascunhos] = useState<Rascunho[]>([]);
  const [mounted, setMounted] = useState(false);
  const [chargebacks, setChargebacks] = useState<any[]>([]);
  const [loadingChargebacks, setLoadingChargebacks] = useState(false);

  // ── Auto-save + carregar auto-save ao montar ────────────
  useEffect(() => {
    // Recupera auto-save se existir
    const savedForm = carregarAutoSave();
    if (savedForm) {
      setForm(savedForm);
    }

    // Carrega lista de rascunhos
    setRascunhos(listarRascunhos());

    // Carrega contestações abertas do Pagar.me
    loadChargebacks();

    setMounted(true);
  }, []);

  // ── Buscar contestações do Pagar.me ────────────────────
  const loadChargebacks = async () => {
    setLoadingChargebacks(true);
    try {
      const res = await fetch("/api/pagarme/list-chargebacks");
      if (res.ok) {
        const data = await res.json();
        setChargebacks(data);
      }
    } catch (error) {
      console.log("Pagar.me API não configurado ou indisponível");
    }
    setLoadingChargebacks(false);
  };

  // ── Auto-save a cada 30s ──────────────────────────────
  useEffect(() => {
    if (!mounted) return;

    const interval = setInterval(() => {
      salvarAutoSave(form);
      setAutoSaveTime(obterUltimoAutoSaveTime());
    }, 30000); // 30 segundos

    return () => clearInterval(interval);
  }, [form, mounted]);

  const set = <K extends keyof FormContestacao>(
    key: K,
    value: FormContestacao[K]
  ) => setForm((f) => ({ ...f, [key]: value }));

  // ── Item helpers ──────────────────────────────────────
  const addItem = () =>
    set("itensPedido", [...form.itensPedido, { descricao: "", valor: "" }]);
  const removeItem = (i: number) =>
    set("itensPedido", form.itensPedido.filter((_, idx) => idx !== i));
  const setItem = (i: number, field: keyof ItemPedido, value: string) => {
    const updated = form.itensPedido.map((it, idx) =>
      idx === i ? { ...it, [field]: value } : it
    );
    set("itensPedido", updated);
  };

  // ── Evento helpers ────────────────────────────────────
  const addEvento = () =>
    set("eventosRastreio", [
      ...form.eventosRastreio,
      { data: "", descricao: "" },
    ]);
  const removeEvento = (i: number) =>
    set("eventosRastreio", form.eventosRastreio.filter((_, idx) => idx !== i));
  const setEvento = (i: number, field: keyof EventoRastreio, value: string) => {
    const updated = form.eventosRastreio.map((ev, idx) =>
      idx === i ? { ...ev, [field]: value } : ev
    );
    set("eventosRastreio", updated);
  };

  // ── Comunicação helpers ───────────────────────────────
  const addCom = () =>
    set("comunicacoes", [
      ...form.comunicacoes,
      { data: "", tipo: "email", descricao: "" },
    ]);
  const removeCom = (i: number) =>
    set("comunicacoes", form.comunicacoes.filter((_, idx) => idx !== i));
  const setCom = (i: number, field: keyof Comunicacao, value: string) => {
    const updated = form.comunicacoes.map((c, idx) =>
      idx === i ? { ...c, [field]: value } : c
    );
    set("comunicacoes", updated);
  };

  // ── Rascunhos helpers ─────────────────────────────────
  const retomarRascunho = (id: string) => {
    const rascunho = obterRascunho(id);
    if (rascunho) {
      setForm(rascunho.formulario);
      setShowRascunhos(false);
    }
  };

  const deletarRascunhoLocal = (id: string) => {
    deletarRascunho(id);
    setRascunhos(listarRascunhos());
  };

  const duplicarRascunhoLocal = (id: string) => {
    const novoRascunho = duplicarRascunho(id);
    if (novoRascunho) {
      setRascunhos(listarRascunhos());
      setForm(novoRascunho.formulario);
      setShowRascunhos(false);
    }
  };

  // ── Submit ────────────────────────────────────────────
  const handleSubmit = async () => {
    setLoading(true);
    localStorage.setItem("contestacao_form", JSON.stringify(form));
    limparAutoSave(); // Limpa auto-save após exportar com sucesso
    router.push("/revisar");
  };

  // ── Step content ──────────────────────────────────────
  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">
              Dados da Contestação
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Gateway / Adquirente</label>
                <select
                  className="input"
                  value={form.gateway}
                  onChange={(e) => set("gateway", e.target.value as Gateway)}
                >
                  <option value="pagarme">Pagar.me</option>
                  <option value="shopify">Shopify Payments</option>
                  <option value="cielo">Cielo</option>
                  <option value="stone">Stone</option>
                  <option value="rede">Rede</option>
                  <option value="generico">Outro / Genérico</option>
                </select>
              </div>
              <div>
                <label className="label">Tipo de Disputa</label>
                <select
                  className="input"
                  value={form.tipoContestacao}
                  onChange={(e) =>
                    set("tipoContestacao", e.target.value as TipoContestacao)
                  }
                >
                  <option value="desacordo_comercial">
                    Desacordo Comercial
                  </option>
                  <option value="produto_nao_recebido">
                    Produto Não Recebido
                  </option>
                  <option value="fraude">Fraude</option>
                  <option value="credito_nao_processado">
                    Crédito Não Processado
                  </option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">ID da Contestação</label>
                <input
                  className="input"
                  placeholder="ex: 4171230241"
                  value={form.contestacaoId}
                  onChange={(e) => set("contestacaoId", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Data da Contestação</label>
                <input
                  type="date"
                  className="input"
                  value={form.dataContestacao}
                  onChange={(e) => set("dataContestacao", e.target.value)}
                />
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">
              Dados da Transação
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Valor (R$)</label>
                <input
                  className="input"
                  placeholder="497,00"
                  value={form.valorTransacao}
                  onChange={(e) => set("valorTransacao", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Data da Transação</label>
                <input
                  type="date"
                  className="input"
                  value={form.dataTransacao}
                  onChange={(e) => set("dataTransacao", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Bandeira</label>
                <select
                  className="input"
                  value={form.bandeira}
                  onChange={(e) => set("bandeira", e.target.value)}
                >
                  <option value="">Selecione...</option>
                  <option value="Visa">Visa</option>
                  <option value="Mastercard">Mastercard</option>
                  <option value="American Express">American Express</option>
                  <option value="Elo">Elo</option>
                  <option value="Hipercard">Hipercard</option>
                </select>
              </div>
              <div>
                <label className="label">Final do Cartão</label>
                <input
                  className="input"
                  placeholder="ex: 8860"
                  maxLength={4}
                  value={form.finalCartao}
                  onChange={(e) => set("finalCartao", e.target.value)}
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">
              Dados do Pedido
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Número do Pedido</label>
                <input
                  className="input"
                  placeholder="ex: #15124"
                  value={form.numeroPedido}
                  onChange={(e) => set("numeroPedido", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Código de Confirmação</label>
                <input
                  className="input"
                  placeholder="ex: 5KUTWWDZA"
                  value={form.codigoConfirmacao}
                  onChange={(e) => set("codigoConfirmacao", e.target.value)}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Itens do Pedido</label>
                <button
                  type="button"
                  onClick={addItem}
                  className="text-sm text-brand-600 hover:text-brand-700 font-medium"
                >
                  + Adicionar item
                </button>
              </div>
              <div className="space-y-2">
                {form.itensPedido.map((item, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <input
                      className="input flex-1"
                      placeholder="Descrição do produto"
                      value={item.descricao}
                      onChange={(e) => setItem(i, "descricao", e.target.value)}
                    />
                    <input
                      className="input w-28"
                      placeholder="R$ 0,00"
                      value={item.valor}
                      onChange={(e) => setItem(i, "valor", e.target.value)}
                    />
                    {form.itensPedido.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        className="text-red-400 hover:text-red-600 mt-2 text-lg leading-none"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">
              Dados do Cliente
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Nome Completo</label>
                <input
                  className="input"
                  placeholder="Nome do comprador"
                  value={form.nomeCliente}
                  onChange={(e) => set("nomeCliente", e.target.value)}
                />
              </div>
              <div>
                <label className="label">CPF</label>
                <input
                  className="input"
                  placeholder="000.000.000-00"
                  value={form.cpfCliente}
                  onChange={(e) => set("cpfCliente", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">E-mail</label>
                <input
                  className="input"
                  type="email"
                  placeholder="cliente@email.com"
                  value={form.emailCliente}
                  onChange={(e) => set("emailCliente", e.target.value)}
                />
              </div>
              <div>
                <label className="label">
                  IP do Comprador{" "}
                  <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  className="input"
                  placeholder="ex: 186.249.31.21"
                  value={form.ipComprador}
                  onChange={(e) => set("ipComprador", e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="label">Endereço de Entrega</label>
              <input
                className="input"
                placeholder="Rua, número, bairro, cidade - UF, CEP"
                value={form.enderecoEntrega}
                onChange={(e) => set("enderecoEntrega", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Endereço de Faturamento</label>
              <input
                className="input"
                placeholder="Igual ao de entrega ou diferente"
                value={form.enderecoFaturamento}
                onChange={(e) => set("enderecoFaturamento", e.target.value)}
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-800">
              Dados de Entrega
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Transportadora</label>
                <input
                  className="input"
                  placeholder="ex: Correios"
                  value={form.transportadora}
                  onChange={(e) => set("transportadora", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Código de Rastreio</label>
                <input
                  className="input"
                  placeholder="ex: NN076279435BR"
                  value={form.codigoRastreio}
                  onChange={(e) => set("codigoRastreio", e.target.value)}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Eventos de Rastreamento</label>
                <button
                  type="button"
                  onClick={addEvento}
                  className="text-sm text-brand-600 hover:text-brand-700 font-medium"
                >
                  + Adicionar evento
                </button>
              </div>
              <div className="space-y-2">
                {form.eventosRastreio.map((ev, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <input
                      type="date"
                      className="input w-40"
                      value={ev.data}
                      onChange={(e) => setEvento(i, "data", e.target.value)}
                    />
                    <input
                      className="input flex-1"
                      placeholder="ex: Objeto entregue ao destinatário"
                      value={ev.descricao}
                      onChange={(e) =>
                        setEvento(i, "descricao", e.target.value)
                      }
                    />
                    {form.eventosRastreio.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEvento(i)}
                        className="text-red-400 hover:text-red-600 mt-2 text-lg leading-none"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">
                  Comunicações com o Cliente{" "}
                  <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <button
                  type="button"
                  onClick={addCom}
                  className="text-sm text-brand-600 hover:text-brand-700 font-medium"
                >
                  + Adicionar
                </button>
              </div>
              <div className="space-y-2">
                {form.comunicacoes.map((c, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <input
                      type="date"
                      className="input w-36"
                      value={c.data}
                      onChange={(e) => setCom(i, "data", e.target.value)}
                    />
                    <select
                      className="input w-32"
                      value={c.tipo}
                      onChange={(e) => setCom(i, "tipo", e.target.value)}
                    >
                      <option value="email">E-mail</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="telefone">Telefone</option>
                      <option value="chat">Chat</option>
                    </select>
                    <input
                      className="input flex-1"
                      placeholder="Descreva a comunicação"
                      value={c.descricao}
                      onChange={(e) =>
                        setCom(i, "descricao", e.target.value)
                      }
                    />
                    <button
                      type="button"
                      onClick={() => removeCom(i)}
                      className="text-red-400 hover:text-red-600 mt-2 text-lg leading-none"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {form.comunicacoes.length === 0 && (
                  <p className="text-sm text-gray-400 italic">
                    Nenhuma comunicação registrada.
                  </p>
                )}
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">
              Dados da Empresa
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Nome da Empresa</label>
                <input
                  className="input"
                  placeholder="Razão social"
                  value={form.nomeEmpresa}
                  onChange={(e) => set("nomeEmpresa", e.target.value)}
                />
              </div>
              <div>
                <label className="label">CNPJ</label>
                <input
                  className="input"
                  placeholder="00.000.000/0000-00"
                  value={form.cnpjEmpresa}
                  onChange={(e) => set("cnpjEmpresa", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">E-mail</label>
                <input
                  className="input"
                  type="email"
                  value={form.emailEmpresa}
                  onChange={(e) => set("emailEmpresa", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Telefone</label>
                <input
                  className="input"
                  placeholder="(11) 99999-9999"
                  value={form.telefoneEmpresa}
                  onChange={(e) => set("telefoneEmpresa", e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="label">Endereço da Empresa</label>
              <input
                className="input"
                value={form.enderecoEmpresa}
                onChange={(e) => set("enderecoEmpresa", e.target.value)}
              />
            </div>
            <div>
              <label className="label">
                URL da Política de Reembolso{" "}
                <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input
                className="input"
                type="url"
                placeholder="https://suaempresa.com.br/politica-reembolso"
                value={form.politicaReembolsoUrl}
                onChange={(e) => set("politicaReembolsoUrl", e.target.value)}
              />
            </div>
          </div>
        );
    }
  };

  if (!mounted) {
    return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Widget Contestações Abertas */}
      {chargebacks.length > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-red-900 flex items-center gap-2">
              🚨 {chargebacks.length} Contestação{chargebacks.length > 1 ? "s" : ""} Aberta{chargebacks.length > 1 ? "s" : ""}
            </h3>
            <button
              type="button"
              onClick={loadChargebacks}
              className="text-sm text-red-600 hover:text-red-700 underline"
            >
              Recarregar
            </button>
          </div>
          <div className="space-y-2">
            {chargebacks.slice(0, 3).map((cb) => (
              <div
                key={cb.id}
                className="bg-white rounded p-3 flex items-center justify-between hover:bg-red-50 transition"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {cb.customerName || "Cliente"} • Pedido #{cb.orderId || cb.chargeId}
                  </p>
                  <p className="text-sm text-gray-600">
                    R$ {cb.amount.toFixed(2)} • {cb.reason}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    // Cria rascunho pré-preenchido a partir da contestação
                    setForm((f) => ({
                      ...f,
                      contestacaoId: cb.id,
                      numeroPedido: cb.orderId || cb.chargeId,
                      nomeCliente: cb.customerName,
                      emailCliente: cb.customerEmail,
                      valorTransacao: cb.amount.toString(),
                    }));
                    setStep(0);
                  }}
                  className="ml-3 btn-primary text-sm px-3 py-1 whitespace-nowrap"
                >
                  Responder
                </button>
              </div>
            ))}
          </div>
          {chargebacks.length > 3 && (
            <p className="mt-2 text-sm text-red-600">
              +{chargebacks.length - 3} mais contestações
            </p>
          )}
        </div>
      )}

      {/* Auto-save badge */}
      {autoSaveTime && (
        <div className="mb-4 flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          <span>
            ✓ Rascunho salvo às <span className="font-medium">{autoSaveTime}</span>
          </span>
          <button
            type="button"
            onClick={() => setShowRascunhos(true)}
            className="text-green-600 hover:text-green-700 font-medium underline"
          >
            Ver rascunhos
          </button>
        </div>
      )}

      {/* Modal de rascunhos */}
      {showRascunhos && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-96 overflow-y-auto shadow-xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  Rascunhos Salvos
                </h3>
                <button
                  type="button"
                  onClick={() => setShowRascunhos(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >
                  ×
                </button>
              </div>

              {rascunhos.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  Nenhum rascunho salvo ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {rascunhos.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{r.titulo}</p>
                        <p className="text-sm text-gray-500">
                          {formatarDataRascunho(r.data)} • ~{r.gastoTokensEstimado} tokens
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => retomarRascunho(r.id)}
                          className="btn-secondary text-sm px-3 py-1"
                        >
                          Retomar
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicarRascunhoLocal(r.id)}
                          className="btn-secondary text-sm px-3 py-1"
                        >
                          Duplicar
                        </button>
                        <button
                          type="button"
                          onClick={() => deletarRascunhoLocal(r.id)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium px-2"
                        >
                          Deletar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex flex-col items-center gap-1 flex-1">
              <button
                type="button"
                onClick={() => i < step && setStep(i)}
                className={`w-8 h-8 rounded-full text-xs font-bold transition-colors ${
                  i === step
                    ? "bg-brand-500 text-white"
                    : i < step
                      ? "bg-brand-100 text-brand-600 cursor-pointer hover:bg-brand-200"
                      : "bg-gray-100 text-gray-400 cursor-default"
                }`}
              >
                {i < step ? "✓" : i + 1}
              </button>
              <span
                className={`text-xs hidden sm:block ${
                  i === step ? "text-brand-600 font-medium" : "text-gray-400"
                }`}
              >
                {s}
              </span>
            </div>
          ))}
        </div>
        <div className="h-1 bg-gray-100 rounded-full mt-1">
          <div
            className="h-1 bg-brand-500 rounded-full transition-all duration-300"
            style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="card p-6 mb-6">{renderStep()}</div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="btn-secondary disabled:opacity-30"
        >
          ← Anterior
        </button>

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className="btn-primary"
          >
            Próximo →
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="btn-primary flex items-center gap-2"
          >
            {loading ? (
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
                Iniciando...
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                Gerar Contestação com IA
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
