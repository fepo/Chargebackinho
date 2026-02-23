import prisma from "@/lib/db";

/**
 * GET /api/defesas/[id]
 * Retorna uma defesa por ID, incluindo dados do chargeback relacionado.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return Response.json({ error: "ID obrigatório" }, { status: 400 });
  }

  try {
    const defesa = await prisma.defesa.findUnique({
      where: { id },
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
            shopifyData: true,
            createdAt: true,
          },
        },
      },
    });

    if (!defesa) {
      return Response.json({ error: "Defesa não encontrada" }, { status: 404 });
    }

    return Response.json(defesa);
  } catch (e) {
    console.error("GET /api/defesas/[id]:", e);
    return Response.json(
      { error: "Erro ao buscar defesa" },
      { status: 500 }
    );
  }
}
