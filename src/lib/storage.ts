import type { FormContestacao } from "@/types";

/**
 * Estrutura de um rascunho salvo no localStorage
 */
export interface Rascunho {
  id: string;
  titulo: string;
  data: string; // ISO timestamp
  formulario: FormContestacao;
  gastoTokensEstimado: number;
}

/**
 * Estrutura do localStorage
 */
export interface RascunhosStorage {
  rascunhos: Rascunho[];
  ultimoRascunhoId?: string;
}

const STORAGE_KEY = "contestacao_rascunhos";
const AUTO_SAVE_KEY = "contestacao_form_autosave";
const LAST_SAVE_TIME_KEY = "contestacao_last_save_time";

/**
 * Gera um ID único para rascunho
 */
function generateId(): string {
  return `rascunho_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calcula título sugestivo do rascunho
 */
function gerarTitulo(form: FormContestacao): string {
  const tiposMap: Record<string, string> = {
    desacordo_comercial: "Desacordo",
    produto_nao_recebido: "Não Recebido",
    fraude: "Fraude",
    credito_nao_processado: "Crédito",
  };

  const tipo = tiposMap[form.tipoContestacao] || "Contestação";
  const pedido = form.numeroPedido || "?";
  const valor = form.valorTransacao || "?";

  return `Pedido #${pedido} - ${tipo} (R$ ${valor})`;
}

/**
 * Estima tokens baseado no tipo e quantidade de dados
 */
function estimarTokens(form: FormContestacao): number {
  const baseTemplateTokens = 250; // template base
  const cachedTokens = 365; // CACHED_CONTEXT
  const dynamicMultiplier = form.itensPedido.length + form.eventosRastreio.length;

  return cachedTokens + baseTemplateTokens + dynamicMultiplier * 25;
}

/**
 * Salva um rascunho (manual ou auto-save)
 */
export function salvarRascunho(form: FormContestacao, manual: boolean = false): Rascunho {
  const id = generateId();
  const rascunho: Rascunho = {
    id,
    titulo: gerarTitulo(form),
    data: new Date().toISOString(),
    formulario: form,
    gastoTokensEstimado: estimarTokens(form),
  };

  // Carrega rascunhos existentes
  const storage = carregarStorage();

  // Adiciona novo rascunho
  storage.rascunhos.push(rascunho);

  // Limita a 50 rascunhos (remove os mais antigos)
  if (storage.rascunhos.length > 50) {
    storage.rascunhos = storage.rascunhos.slice(-50);
  }

  // Se for manual, marca como último
  if (manual) {
    storage.ultimoRascunhoId = id;
  }

  // Salva no localStorage
  localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));

  return rascunho;
}

/**
 * Salva formulário no localStorage para auto-save (sem criar rascunho nomeado)
 * Usado a cada 30s para evitar perda de dados
 */
export function salvarAutoSave(form: FormContestacao): void {
  try {
    localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(form));
    localStorage.setItem(LAST_SAVE_TIME_KEY, new Date().toISOString());
  } catch (e) {
    console.error("Erro ao salvar auto-save:", e);
  }
}

/**
 * Recupera formulário do auto-save (se existir)
 */
export function carregarAutoSave(): FormContestacao | null {
  try {
    const saved = localStorage.getItem(AUTO_SAVE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    console.error("Erro ao carregar auto-save:", e);
    return null;
  }
}

/**
 * Limpa auto-save (após exportar com sucesso)
 */
export function limparAutoSave(): void {
  localStorage.removeItem(AUTO_SAVE_KEY);
  localStorage.removeItem(LAST_SAVE_TIME_KEY);
}

/**
 * Retorna hora do último auto-save formatada
 */
export function obterUltimoAutoSaveTime(): string | null {
  try {
    const timestamp = localStorage.getItem(LAST_SAVE_TIME_KEY);
    if (!timestamp) return null;

    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${hours}:${minutes}`;
  } catch (e) {
    return null;
  }
}

/**
 * Carrega estrutura de rascunhos do localStorage
 */
function carregarStorage(): RascunhosStorage {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : { rascunhos: [] };
  } catch (e) {
    console.error("Erro ao carregar rascunhos:", e);
    return { rascunhos: [] };
  }
}

/**
 * Lista todos os rascunhos (ordenado por data descendente)
 */
export function listarRascunhos(): Rascunho[] {
  const storage = carregarStorage();
  return storage.rascunhos.sort(
    (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
  );
}

/**
 * Recupera um rascunho pelo ID
 */
export function obterRascunho(id: string): Rascunho | null {
  const storage = carregarStorage();
  return storage.rascunhos.find((r) => r.id === id) || null;
}

/**
 * Deleta um rascunho pelo ID
 */
export function deletarRascunho(id: string): void {
  const storage = carregarStorage();
  storage.rascunhos = storage.rascunhos.filter((r) => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
}

/**
 * Duplica um rascunho (cria cópia com novo ID e data)
 */
export function duplicarRascunho(id: string): Rascunho | null {
  const original = obterRascunho(id);
  if (!original) return null;

  return salvarRascunho(original.formulario, true);
}

/**
 * Retorna rascunhos recentes (últimos 5)
 */
export function obterRascunhosRecentes(): Rascunho[] {
  return listarRascunhos().slice(0, 5);
}

/**
 * Filtra rascunhos por tipo de contestação
 */
export function filtrarRascunhosPorTipo(tipo: string): Rascunho[] {
  const storage = carregarStorage();
  return storage.rascunhos.filter(
    (r) => r.formulario.tipoContestacao === tipo
  );
}

/**
 * Formata data do rascunho para exibição
 */
export function formatarDataRascunho(isoDate: string): string {
  const date = new Date(isoDate);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  if (isToday) {
    return `Hoje às ${hours}:${minutes}`;
  } else if (isYesterday) {
    return `Ontem às ${hours}:${minutes}`;
  } else {
    return date.toLocaleDateString("pt-BR") + ` às ${hours}:${minutes}`;
  }
}
