"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FormContestacao } from "@/types";

type Status = "gerando" | "pronto" | "erro";

export default function RevisarPage() {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [status, setStatus] = useState<Status>("gerando");
  const [erro, setErro] = useState("");
  const [exportando, setExportando] = useState<"pdf" | "docx" | null>(null);
  const [copiado, setCopiado] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Resolve the document title from form data
  const [titulo, setTitulo] = useState("CONTESTAÇÃO DE CHARGEBACK");

  useEffect(() => {
    const raw = localStorage.getItem("contestacao_form");
    if (!raw) {
      router.push("/");
      return;
    }

    const formData: FormContestacao = JSON.parse(raw);
    const id = formData.contestacaoId || formData.numeroPedido || "";
    if (id) setTitulo(`CONTESTAÇÃO DE CHARGEBACK — ${id}`);

    // Carrega contexto enriquecido (se disponível da tela de análise)
    let enrichedContext = null;
    try {
      const enrichedRaw = localStorage.getItem("contestacao_enriched_context");
      if (enrichedRaw) enrichedContext = JSON.parse(enrichedRaw);
    } catch { /* ignora */ }

    let accumulated = "";

    fetch("/api/gerar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formData, enrichedContext }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Erro ${res.status}`);
        if (!res.body) throw new Error("Resposta vazia");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          setTexto(accumulated);
          // Auto-resize textarea
          if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
          }
        }

        setStatus("pronto");
      })
      .catch((err) => {
        setErro(err.message || "Erro ao gerar contestação.");
        setStatus("erro");
      });
  }, [router]);

  const handleExportDocx = async () => {
    setExportando("docx");
    try {
      const res = await fetch("/api/exportar-docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto, titulo }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "contestacao.docx";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportando(null);
    }
  };

  const handleExportPdf = async () => {
    setExportando("pdf");
    try {
      const res = await fetch("/api/exportar-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto, titulo }),
      });
      const html = await res.text();
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      // Clean up after a delay
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } finally {
      setExportando(null);
    }
  };

  const handleCopiar = async () => {
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const wordCount = texto.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            onClick={() => router.push("/")}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2">
            ← Voltar ao formulário
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Revisar Contestação</h1>
          <p className="text-gray-500 text-sm mt-1">
            {status === "gerando"
              ? "A IA está redigindo seu documento..."
              : status === "pronto"
              ? `Documento gerado — ${wordCount.toLocaleString()} palavras. Revise, edite e exporte.`
              : "Erro na geração."}
          </p>
        </div>

        {status === "pronto" && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleCopiar}
              className="btn-secondary text-sm flex items-center gap-1.5">
              {copiado ? (
                <>
                  <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copiado!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copiar
                </>
              )}
            </button>

            <button
              onClick={handleExportDocx}
              disabled={exportando !== null}
              className="btn-secondary text-sm flex items-center gap-1.5">
              {exportando === "docx" ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
              Word (.docx)
            </button>

            <button
              onClick={handleExportPdf}
              disabled={exportando !== null}
              className="btn-primary text-sm flex items-center gap-1.5">
              {exportando === "pdf" ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              )}
              PDF
            </button>
          </div>
        )}
      </div>

      {/* Status indicator while streaming */}
      {status === "gerando" && (
        <div className="card px-4 py-3 flex items-center gap-3 border-brand-100 bg-brand-50">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-2 h-2 rounded-full bg-brand-500 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
          <span className="text-sm text-brand-700 font-medium">
            Claude está redigindo o documento...
          </span>
        </div>
      )}

      {/* Error state */}
      {status === "erro" && (
        <div className="card px-4 py-3 border-red-200 bg-red-50">
          <p className="text-sm text-red-700 font-medium">Erro: {erro}</p>
          <p className="text-xs text-red-500 mt-1">Verifique se a variável ANTHROPIC_API_KEY está configurada no .env.local</p>
        </div>
      )}

      {/* Document editor */}
      {(status === "gerando" || status === "pronto") && (
        <div className="card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Documento
            </span>
            {status === "pronto" && (
              <span className="text-xs text-gray-400">Clique no texto para editar</span>
            )}
          </div>
          <textarea
            ref={textareaRef}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            readOnly={status === "gerando"}
            className="w-full p-6 font-mono text-sm leading-relaxed resize-none focus:outline-none min-h-[500px] bg-white"
            style={{ height: "auto" }}
            spellCheck={false}
          />
        </div>
      )}

      {/* Send section (future) */}
      {status === "pronto" && (
        <div className="card p-4 bg-amber-50 border-amber-200">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-800">Envio automático</p>
              <p className="text-xs text-amber-600 mt-0.5">
                A integração direta com Pagar.me, Shopify e Cielo para envio automático está em desenvolvimento.
                Por enquanto, exporte o documento e faça o upload manualmente na plataforma da adquirente.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
