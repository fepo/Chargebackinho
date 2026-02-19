"use server";

import { PagarmeAPI } from "@/lib/pagarme";

interface AprovarDefesaRequest {
  defesaId: string;
  chargebackId: string;
  dossieMD: string; // Markdown do dossiê para enviar
  parecer?: string; // Parecer jurídico resumido
  submitToPagarme?: boolean; // Se deve submeter resposta para Pagar.me
}

/**
 * POST /api/defesas/aprovar
 *
 * Aprova uma defesa e opcionalmente submete para Pagar.me
 * - Valida defesa existe
 * - Marca como submitted
 * - Se submitToPagarme=true, envia resposta à Pagar.me
 * - Retorna status da submissão
 *
 * Usado por: Dashboard (usuário clica "Enviar Defesa")
 *           ou n8n (se configurado para auto-submit)
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

    // TODO: Buscar defesa do localStorage
    // const defesaSalva = getDefesaById(body.defesaId);
    // if (!defesaSalva) {
    //   return Response.json({ error: "Defesa não encontrada" }, { status: 404 });
    // }

    let submitResult: any = null;

    // Se solicitado, submete para Pagar.me
    if (body.submitToPagarme) {
      try {
        const pagarme = new PagarmeAPI(process.env.PAGARME_API_KEY || "");

        // Submete defesa de chargeback (converte texto para Buffer)
        const evidenceBuffer = Buffer.from(body.dossieMD, "utf-8");
        submitResult = await pagarme.submitChargebackDefense(
          body.chargebackId,
          evidenceBuffer,
          "document"
        );

        console.log(
          `Resposta de chargeback ${body.chargebackId} submetida:`,
          submitResult
        );
      } catch (error) {
        console.error(
          "Erro ao submeter resposta à Pagar.me:",
          error
        );
        // Não falha completamente - continua mesmo se Pagar.me falhar
        return Response.json(
          {
            success: false,
            error: `Defesa aprovada localmente, mas erro ao submeter para Pagar.me: ${error instanceof Error ? error.message : "Erro desconhecido"}`,
            defesaId: body.defesaId,
            chargebackId: body.chargebackId,
          },
          { status: 500 }
        );
      }
    }

    // TODO: Marcar defesa como submitted no localStorage
    // updateDefesaStatus(body.defesaId, "submitted", submitResult);

    return Response.json({
      success: true,
      defesaId: body.defesaId,
      chargebackId: body.chargebackId,
      status: body.submitToPagarme ? "submitted" : "approved",
      message: body.submitToPagarme
        ? "Defesa aprovada e submetida à Pagar.me"
        : "Defesa aprovada localmente",
      pagarmeResponse: submitResult,
    });
  } catch (error) {
    console.error("Erro ao aprovar defesa:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Erro ao aprovar defesa",
      },
      { status: 500 }
    );
  }
}
