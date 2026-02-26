import { prisma } from "@/lib/db";

/**
 * GET /api/defesas
 * Lista todas as defesas com dados do chargeback relacionado.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const source = searchParams.get("source"); // "n8n" | "manual"
    const status = searchParams.get("status");

    const defesas = await prisma.defesa.findMany({
      where: {
        ...(source ? { source } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        chargeback: {
          select: {
            id: true,
            externalId: true,
            chargeId: true,
            gateway: true,
            status: true,
            reason: true,
            tipoContestacao: true,
            valorTransacao: true,
            bandeira: true,
            finalCartao: true,
            dataTransacao: true,
            numeroPedido: true,
            nomeCliente: true,
            cpfCliente: true,
            emailCliente: true,
            enderecoEntrega: true,
            transportadora: true,
            codigoRastreio: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(defesas);
  } catch (error) {
    console.error("Erro ao listar defesas:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro ao listar defesas" },
      { status: 500 }
    );
  }
}
