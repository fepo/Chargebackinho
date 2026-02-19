import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// -------------------------------------------------
// Tipos principais do Pagar.me v5
// -------------------------------------------------
type PagarmeDisputeEvent = {
  id: string;
  type:
    | "charge.dispute.created"
    | "charge.dispute.updated"
    | "charge.dispute.closed"
    | "charge.dispute.won"
    | "charge.dispute.lost";
  created_at: string;
  data: {
    id: string;              // charge_id
    code: string;            // código do pedido
    amount: number;          // em centavos
    dispute: {
      id: string;
      status: string;        // open | won | lost
      amount: number;
      reason_code: string;   // ex: "4853" (merchandise not received)
      reason_description: string;
      due_date: string;      // prazo para responder
      created_at: string;
      updated_at: string;
    };
    customer: {
      id: string;
      name: string;
      email: string;
    };
  };
};

// -------------------------------------------------
// Verifica assinatura do Pagar.me
// -------------------------------------------------
function verifySignature(payload: string, signature: string): boolean {
  const secret = process.env.PAGARME_WEBHOOK_SECRET;
  if (!secret) throw new Error("PAGARME_WEBHOOK_SECRET não configurada");

  const hmac = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(signature));
}

// -------------------------------------------------
// Handler principal
// -------------------------------------------------
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature") ?? "";

  // 1. Valida assinatura
  try {
    if (!verifySignature(rawBody, signature)) {
      console.warn("[pagarme-webhook] Assinatura inválida");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } catch (err) {
    console.error("[pagarme-webhook] Erro na validação:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  // 2. Parse do payload
  let event: PagarmeDisputeEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 3. Log completo (importante para auditar chargebacks)
  console.log("[pagarme-webhook] Evento recebido:", {
    id: event.id,
    type: event.type,
    charge_id: event.data?.id,
    dispute_id: event.data?.dispute?.id,
    status: event.data?.dispute?.status,
  });

  // 4. Roteia por tipo de evento
  try {
    switch (event.type) {
      case "charge.dispute.created":
        await handleDisputeCreated(event);
        break;

      case "charge.dispute.updated":
        await handleDisputeUpdated(event);
        break;

      case "charge.dispute.won":
      case "charge.dispute.lost":
      case "charge.dispute.closed":
        await handleDisputeClosed(event);
        break;

      default:
        // Evento não mapeado — ignora silenciosamente
        console.log("[pagarme-webhook] Evento ignorado:", event.type);
    }
  } catch (err) {
    console.error("[pagarme-webhook] Erro ao processar evento:", err);
    // Retorna 200 mesmo com erro para o Pagar.me não reenviar em loop
    // Trate reprocessamento via fila se necessário
    return NextResponse.json({ received: true, error: "processing_failed" });
  }

  return NextResponse.json({ received: true });
}

// -------------------------------------------------
// Handlers por evento
// -------------------------------------------------

async function handleDisputeCreated(event: PagarmeDisputeEvent) {
  const { dispute, customer, id: chargeId, code: orderCode } = event.data;

  console.log(`[dispute.created] charge=${chargeId} dispute=${dispute.id} due=${dispute.due_date}`);

  // TODO: salvar no banco
  // await db.dispute.create({ data: { ... } })

  // TODO: notificar time (email / Slack)
  // await sendSlackAlert({ ... })
}

async function handleDisputeUpdated(event: PagarmeDisputeEvent) {
  const { dispute, id: chargeId } = event.data;

  console.log(`[dispute.updated] charge=${chargeId} status=${dispute.status}`);

  // TODO: atualizar status no banco
  // await db.dispute.update({ where: { pagarmeId: dispute.id }, data: { status: dispute.status } })
}

async function handleDisputeClosed(event: PagarmeDisputeEvent) {
  const { dispute, id: chargeId } = event.data;
  const won = event.type === "charge.dispute.won";

  console.log(`[dispute.closed] charge=${chargeId} result=${won ? "WON" : "LOST"}`);

  // TODO: atualizar banco + tomar ação (reembolso, cancelamento etc)
}
