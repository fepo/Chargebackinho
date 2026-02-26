import crypto from "crypto";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    // ── Validação HMAC SHA-256 (Shopify usa base64, não hex) ──
    const signature = req.headers.get("x-shopify-hmac-sha256");
    const topic = req.headers.get("x-shopify-topic");
    const secret = process.env.SHOPIFY_API_SECRET;

    if (!secret) {
      console.warn("SHOPIFY_API_SECRET não configurado");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    if (!signature || !topic) {
      return new Response("Missing signature or topic", { status: 401 });
    }

    const bodyText = await req.text();
    const expected = crypto
      .createHmac("sha256", secret)
      .update(bodyText, "utf8")
      .digest("base64");

    if (signature !== expected) {
      console.warn("[Shopify webhook] Assinatura inválida");
      return new Response("Invalid signature", { status: 401 });
    }

    // ── Filtrar apenas eventos relevantes ──
    if (topic !== "orders/fulfilled" && topic !== "fulfillments/create") {
      console.log(`[Shopify webhook] Evento ignorado: ${topic}`);
      return Response.json({ received: true, ignored: true });
    }

    const payload = JSON.parse(bodyText);

    // ── Idempotência via WebhookEvent ──
    const eventExternalId = `shopify_${topic}_${payload.id ?? payload.order_id ?? Date.now()}`;
    const existing = await prisma.webhookEvent.findUnique({
      where: { source_externalId: { source: "shopify", externalId: eventExternalId } },
    });
    if (existing) {
      console.log(`[Shopify webhook] Evento já processado: ${eventExternalId}`);
      return Response.json({ received: true, duplicate: true });
    }

    // ── Extrair dados do payload ──
    let orderName = "";
    let customerEmail = "";
    let totalPrice = 0;
    let fulfillmentStatus = "";
    let trackingNumber = "";
    let trackingCompany = "";
    let trackingUrl = "";

    if (topic === "orders/fulfilled") {
      orderName = payload.name || "";
      customerEmail = payload.email || "";
      totalPrice = parseFloat(payload.total_price) || 0;
      fulfillmentStatus = payload.fulfillment_status || "fulfilled";
      const fulfillment = payload.fulfillments?.[0];
      if (fulfillment?.tracking_info) {
        trackingNumber = fulfillment.tracking_info.number || "";
        trackingCompany = fulfillment.tracking_info.company || "";
        trackingUrl = fulfillment.tracking_info.url || "";
      }
    } else if (topic === "fulfillments/create") {
      const orderNameRaw = payload.order_name || "";
      orderName = orderNameRaw.startsWith("#") ? orderNameRaw : `#${orderNameRaw}`;
      customerEmail = payload.email || payload.customer?.email || "";
      totalPrice = parseFloat(payload.total_price) || 0;
      fulfillmentStatus = payload.status || "pending";
      trackingNumber = payload.tracking_number || "";
      trackingCompany = payload.tracking_company || "";
      trackingUrl = payload.tracking_url || "";
    }

    console.log(
      `[Shopify webhook] ${topic} | orderName=${orderName} | email=${customerEmail} | tracking=${trackingNumber}`
    );

    // ── Buscar chargeback correspondente no DB ──
    // SQLite é case-insensitive por padrão para ASCII
    const chargebacks = await prisma.chargeback.findMany({
      where: customerEmail
        ? { emailCliente: customerEmail.toLowerCase() }
        : undefined,
    });

    // Matching: email + valor aproximado (±5%)
    const candidates = chargebacks.filter((cb) => {
      if (cb.emailCliente?.toLowerCase() !== customerEmail?.toLowerCase()) return false;
      const cbAmount = parseFloat(cb.valorTransacao ?? "0");
      if (totalPrice === 0 || cbAmount === 0) return true;
      const diff = Math.abs(cbAmount - totalPrice) / cbAmount;
      return diff <= 0.05;
    });

    // ── Registrar evento de webhook ──
    await prisma.webhookEvent.create({
      data: {
        source: "shopify",
        eventType: topic,
        externalId: eventExternalId,
        payload: bodyText,
        processed: candidates.length > 0,
      },
    });

    if (candidates.length === 0) {
      console.log(`[Shopify webhook] Nenhum chargeback encontrado para ${customerEmail}`);
      return Response.json({ received: true, matched: false });
    }

    // Pegar o mais recente
    const matched = candidates.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];

    // ── Enriquecer chargeback no DB ──
    await prisma.chargeback.update({
      where: { id: matched.id },
      data: {
        numeroPedido: matched.numeroPedido || orderName || undefined,
        transportadora: matched.transportadora || trackingCompany || undefined,
        codigoRastreio: matched.codigoRastreio || trackingNumber || undefined,
        shopifyData: JSON.stringify({
          orderName,
          fulfillmentStatus,
          trackingNumber,
          trackingCompany,
          trackingUrl,
          webhookEvent: topic,
          webhookReceivedAt: new Date().toISOString(),
        }),
      },
    });

    console.log(`✅ [Shopify webhook] Chargeback ${matched.id} enriquecido com dados de fulfillment`);

    return Response.json({
      received: true,
      matched: true,
      chargebackId: matched.id,
      message: `Chargeback atualizado com dados de ${orderName}`,
    });
  } catch (error) {
    console.error("[Shopify webhook] Erro:", error);
    // Sempre retorna 200 para evitar retries infinitos
    return Response.json({ received: true, error: "Logged internally" });
  }
}
