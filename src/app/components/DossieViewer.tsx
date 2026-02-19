"use client";

import { useState } from "react";


interface DossieViewerProps {
  markdown: string;
  title: string;
}

export function DossieViewer({ markdown, title }: DossieViewerProps) {
  const [viewMode, setViewMode] = useState<"formatted" | "raw">("formatted");
  const [copied, setCopied] = useState(false);

  // ── Copiar para clipboard ──────────────────────────
  const handleCopy = () => {
    navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Download como arquivo ──────────────────────────
  const handleDownload = () => {
    const element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/markdown;charset=utf-8," + encodeURIComponent(markdown)
    );
    element.setAttribute("download", `${title.replace(/\s+/g, "-")}.md`);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // ── Print (convertendo para PDF)
  const handlePrint = () => {
    const printWindow = window.open("", "", "height=600,width=800");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${title}</title>
            <style>
              body {
                font-family: 'Times New Roman', Times, serif;
                line-height: 1.6;
                max-width: 900px;
                margin: 0 auto;
                padding: 40px;
                color: #333;
              }
              h1, h2, h3 { margin-top: 20px; margin-bottom: 10px; }
              h1 { font-size: 24px; border-bottom: 2px solid #000; padding-bottom: 10px; }
              h2 { font-size: 18px; margin-top: 15px; }
              h3 { font-size: 16px; }
              p { margin: 10px 0; }
              ul, ol { margin: 10px 0 10px 20px; }
              strong { font-weight: bold; }
              em { font-style: italic; }
              code { background: #f4f4f4; padding: 2px 5px; font-family: monospace; }
              .page-break { page-break-after: always; margin-top: 40px; }
              @media print {
                body { padding: 0; }
              }
            </style>
          </head>
          <body>
            ${markdown
          .split("\n")
          .map((line) => {
            if (line.startsWith("# "))
              return `<h1>${line.substring(2)}</h1>`;
            if (line.startsWith("## "))
              return `<h2>${line.substring(3)}</h2>`;
            if (line.startsWith("### "))
              return `<h3>${line.substring(4)}</h3>`;
            if (line.startsWith("- "))
              return `<li>${line.substring(2)}</li>`;
            if (line.trim() === "") return "<br>";
            return `<p>${line}</p>`;
          })
          .join("\n")}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="card space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">📄 Dossiê de Defesa</h2>
          <p className="text-sm text-gray-600 mt-1">Conteúdo completo para envio à Pagar.me</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* View Mode Toggle */}
        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setViewMode("formatted")}
            className={`px-3 py-1 rounded transition-colors ${viewMode === "formatted"
                ? "bg-white text-brand-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
              }`}
          >
            👁️ Formatado
          </button>
          <button
            onClick={() => setViewMode("raw")}
            className={`px-3 py-1 rounded transition-colors ${viewMode === "raw"
                ? "bg-white text-brand-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
              }`}
          >
            {"</> Raw"}
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            {copied ? "Copiado!" : "Copiar"}
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            MD
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            PDF
          </button>
        </div>
      </div>

      {/* Viewer */}
      {viewMode === "formatted" ? (
        <div className="prose prose-sm max-w-none bg-gray-50 p-6 rounded-lg border border-gray-200 max-h-96 overflow-y-auto">
          {markdown.split("\n").map((line, i) => {
            if (line.startsWith("# ")) return <h1 key={i} className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-gray-300 pb-2">{line.slice(2)}</h1>;
            if (line.startsWith("## ")) return <h2 key={i} className="text-xl font-bold text-gray-900 mt-6 mb-3">{line.slice(3)}</h2>;
            if (line.startsWith("### ")) return <h3 key={i} className="text-lg font-semibold text-gray-900 mt-4 mb-2">{line.slice(4)}</h3>;
            if (line.startsWith("- ")) return <li key={i} className="text-gray-700 ml-4 list-disc">{line.slice(2)}</li>;
            if (line.trim() === "") return <br key={i} />;
            return <p key={i} className="text-gray-700 mb-2">{line}</p>;
          })}
        </div>
      ) : (
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 max-h-96 overflow-y-auto">
          <pre className="font-mono text-xs text-gray-700 whitespace-pre-wrap break-words">
            {markdown}
          </pre>
        </div>
      )}

      {/* Stats */}
      <div className="border-t border-gray-200 pt-4 flex items-center justify-between text-sm text-gray-600">
        <span>
          📊 <strong>{markdown.split("\n").length}</strong> linhas •{" "}
          <strong>{markdown.split(" ").length}</strong> palavras •{" "}
          <strong>{markdown.length}</strong> caracteres
        </span>
        <span>Pronto para envio à Pagar.me ✓</span>
      </div>
    </div>
  );
}
