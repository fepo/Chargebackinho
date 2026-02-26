"use server";

import type { FormContestacao } from "@/types";
import { prisma } from "@/lib/db";

interface SalvarDefesaRequest {
  contestacaoId: string;
  chargebackId: string;
  dossie: string;
  dossieTitulo: string;
  dossieMD: string;
  contestacao: FormContestacao;
  parecer?: {
    tipo: "produto_nao_recebido" | "fraude" | "desacordo_comercial" | "credito_nao_processado";
    viabilidade: number;
    parecer: string;
    argumentos: string[];
    recomendacao: "responder" | "nao_responder" | "acompanhar";
    confianca: number;
  };
  shopifyData?: {
    orderId: string;
    fulfillmentStatus: string;
    financialStatus: string;
    trackingInfo?: { number: string; company: string; url?: string };
  };
  source: "n8n" | "manual";
}

/**
 * POST /api/defesas/salvar
 * Salva uma defesa gerada (por n8n ou manual) no banco de dados.
 */
export async function POST(request: Request) {
  try {
    const body: SalvarDefesaRequest = await request.json();

    if (!body.contestacaoId || !body.chargebackId || !body.dossie || !body.contestacao) {
      return Response.json(
        { error: "Campos obrigatórios faltando: contestacaoId, chargebackId, dossie, contestacao" },
        { status: 400 }
      );
    }

    // Garante que o Chargeback pai existe (cria se vier direto do n8n sem webhook)
    const chargeback = await prisma.chargeback.upsert({
      where: { externalId: body.chargebackId },
      update: {},
      create: {
        externalId: body.chargebackId,
        gateway: body.contestacao.gateway || "pagarme",
        status: "pending",
        nomeCliente: body.contestacao.nomeCliente,
        emailCliente: body.contestacao.emailCliente,
        valorTransacao: body.contestacao.valorTransacao,
        numeroPedido: body.contestacao.numeroPedido,
        tipoContestacao: body.contestacao.tipoContestacao,
        shopifyData: body.shopifyData ? JSON.stringify(body.shopifyData) : null,
      },
    });

    const defesa = await prisma.defesa.create({
      data: {
        chargebackId: chargeback.id,
        dossie: body.dossieMD,
        contestacao: body.dossie,
        parecerJuridico: body.parecer?.parecer ?? null,
        status: "drafted",
        source: body.source,
      },
    });

    console.log(`[${body.source}] Defesa ${defesa.id} salva para chargeback ${chargeback.id}`);

    return Response.json({
      success: true,
      defesaId: defesa.id,
      contestacaoId: body.contestacaoId,
      chargebackId: body.chargebackId,
      status: "drafted",
      message: "Defesa salva. Aguardando aprovação do usuário.",
      dashboardUrl: `/defesa/${defesa.id}`,
    });
  } catch (error) {
    console.error("Erro ao salvar defesa:", error);
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Erro ao salvar defesa" },
      { status: 500 }
    );
  }
}

