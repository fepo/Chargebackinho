import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
} from "docx";

export async function POST(req: Request) {
  const { texto, titulo }: { texto: string; titulo: string } = await req.json();

  const lines = texto.split("\n");

  const children = lines.map((line) => {
    const trimmed = line.trim();

    // Roman numeral section headings like "I. TITLE" or "II. TITLE"
    const isHeading = /^[IVXLCDM]+\.\s+[A-ZÁÉÍÓÚÃÕÇ]/.test(trimmed);

    if (isHeading) {
      return new Paragraph({
        text: trimmed,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 120 },
      });
    }

    if (trimmed === "") {
      return new Paragraph({ text: "" });
    }

    // Bullet items
    if (trimmed.startsWith("•")) {
      return new Paragraph({
        indent: { left: 720 },
        children: [new TextRun({ text: trimmed, size: 22 })],
      });
    }

    // Bold sub-headings like "1.1 Something" or "2.3 Something"
    const isSubHeading = /^\d+\.\d+\s/.test(trimmed);

    return new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      children: [
        new TextRun({
          text: trimmed,
          size: 22,
          bold: isSubHeading,
        }),
      ],
      spacing: { before: 60, after: 60 },
    });
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: titulo || "CONTESTAÇÃO DE CHARGEBACK",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 400 },
          }),
          new Paragraph({
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
            },
            spacing: { before: 0, after: 400 },
          }),
          ...children,
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="contestacao.docx"`,
    },
  });
}
