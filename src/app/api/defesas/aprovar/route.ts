"use server";

import { PagarmeAPI } from "@/lib/pagarme";
import { prisma } from "@/lib/db";

interface AprovarDefesaRequest {
  defesaId: string;
  chargebackId: string;
  dossieMD: string;
  parecer?: string;
  submitToPagarme?: boolean;
}

/**
 * POST /api/defesas/aprovar
 * Aprova uma defesa e opcionalmente submete para Pagar.me.
 */
export async function POST(request: Request) {
  try {
    const body: AprovarDefesaRequest = await request.json();

    if (!body.defesaId || !body.chargebackId) {
      return Response.json(
        { error: "defesaId e chargebackId são obrigatórios" },
        { status: 400 }
      );
    }

    // Busca defesa no banco
    const defesa = await prisma.defesa.findUnique({ where: { id: body.defesaId } });
    if (!defesa) {
      return Response.json({ error: "Defesa não encontrada" }, { status: 404 });
    }

    let submitResult: any = null;

    if (body.submitToPagarme) {
      try {
        const pagarme = new PagarmeAPI(process.env.PAGARME_API_KEY || "");
        const evidenceBuffer = Buffer.from(body.dossieMD, "utf-8");
        submitResult = await pagarme.submitChargebackDefense(
          body.chargebackId,
          evidenceBuffer,
          "document"
        );
        console.log(`Defesa ${body.defesaId} submetida ao Pagar.me:`, submitResult);
      } catch (error) {
        console.error("Erro ao submeter ao Pagar.me:", error);
        return Response.json(
          {
            success: false,
            error: `Defesa aprovada, mas erro ao submeter para Pagar.me: ${error instanceof Error ? error.message : "Erro desconhecido"}`,
            defesaId: body.defesaId,
            chargebackId: body.chargebackId,
          },
          { status: 500 }
        );
      }
    }

    const novoStatus = body.submitToPagarme ? "submitted" : "approved";

    // Atualiza status no banco
    await prisma.defesa.update({
      where: { id: body.defesaId },
      data: {
        status: novoStatus,
        pagarmeResponse: submitResult ? JSON.stringify(submitResult) : null,
        submittedAt: body.submitToPagarme ? new Date() : null,
      },
    });

    // Atualiza status do chargeback pai
    await prisma.chargeback.update({
      where: { externalId: body.chargebackId },
      data: { status: "defending" },
    }).catch(() => { }); // ignora se não encontrar pelo externalId

    return Response.json({
      success: true,
      defesaId: body.defesaId,
      chargebackId: body.chargebackId,
      status: novoStatus,
      message: body.submitToPagarme
        ? "Defesa aprovada e submetida à Pagar.me"
        : "Defesa aprovada localmente",
      pagarmeResponse: submitResult,
    });
  } catch (error) {
    console.error("Erro ao aprovar defesa:", error);
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Erro ao aprovar defesa" },
      { status: 500 }
    );
  }
}

