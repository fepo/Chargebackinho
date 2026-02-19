// PDF export: returns an HTML page optimized for browser print-to-PDF
// The client opens this in a new tab and the browser handles PDF generation.
// This avoids heavy server-side deps (puppeteer/chromium) for the MVP.

export async function POST(req: Request) {
  const { texto, titulo }: { texto: string; titulo: string } = await req.json();

  // Convert plain text to styled HTML
  const lines = texto.split("\n");

  const htmlLines = lines
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed === "") return "<br/>";

      const isSection = /^[IVXLCDM]+\.\s+[A-ZÁÉÍÓÚÃÕÇ]/.test(trimmed);
      if (isSection) return `<h2>${trimmed}</h2>`;

      const isSubSection = /^\d+\.\d+\s/.test(trimmed);
      if (isSubSection) return `<p class="sub">${trimmed}</p>`;

      if (trimmed.startsWith("•")) return `<p class="bullet">${trimmed}</p>`;

      // Table-like rows with |
      if (trimmed.includes("|")) return `<p class="table-row">${trimmed}</p>`;

      return `<p>${trimmed}</p>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>${titulo || "Contestação de Chargeback"}</title>
<style>
  @page { margin: 2.5cm; size: A4; }
  * { box-sizing: border-box; }
  body {
    font-family: "Times New Roman", serif;
    font-size: 12pt;
    line-height: 1.6;
    color: #111;
    max-width: 100%;
  }
  h1 {
    font-size: 14pt;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 8pt;
    border-bottom: 2px solid #333;
    padding-bottom: 8pt;
  }
  h2 {
    font-size: 12pt;
    text-transform: uppercase;
    font-weight: bold;
    margin-top: 18pt;
    margin-bottom: 6pt;
    color: #1a1a6e;
    border-left: 3px solid #1a1a6e;
    padding-left: 8pt;
  }
  p { margin: 4pt 0; text-align: justify; }
  p.sub { font-weight: bold; margin-top: 10pt; }
  p.bullet { margin-left: 24pt; }
  p.table-row { font-family: "Courier New", monospace; font-size: 10pt; }
  .header { text-align: center; margin-bottom: 24pt; }
  @media print { body { print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="header">
  <h1>${titulo || "CONTESTAÇÃO DE CHARGEBACK"}</h1>
</div>
${htmlLines}
<script>window.onload = () => window.print();</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
