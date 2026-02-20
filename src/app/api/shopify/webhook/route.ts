import crypto from "crypto";

// Reutilizar as mesmas funções de Store do webhook Pagar.me
const BLOB_KEY = "chargebacks-store.json";

async function readStore(): Promise<any[]> {
  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: BLOB_KEY });
    if (!blobs.length) return [];
    const res = await fetch(blobs[0].url);
    return await res.json();
  } catch {
    const g = globalThis as any;
    return g._cbstore ?? [];
  }
}

async function writeStore(data: any[]) {
  try {
    const { put } = await import("@vercel/blob");
    await put(BLOB_KEY, JSON.stringify(data), {
      access: "public",
      contentType: "application/json",
      allowOverwrite: true,
    });
  } catch {
    const g = globalThis as any;
    g._cbstore = data;
  }
}

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

    // ── Extrair dados do payload ──
    let orderName = "";
    let customerEmail = "";
    let totalPrice = 0;
    let fulfillmentStatus = "";
    let trackingNumber = "";
    let trackingCompany = "";
    let trackingUrl = "";

    if (topic === "orders/fulfilled") {
      // orders/fulfilled: name = "#1234", fulfillment_status, email
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
      // fulfillments/create: order_name (sem #), email pode não estar
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

    // ── Buscar chargeback correspondente ──
    // Matching: email === customerEmail, e valor aproximado (±5%)
    const chargebacks = await readStore();
    const candidates = chargebacks.filter((cb) => {
      if (cb.customerEmail?.toLowerCase() !== customerEmail?.toLowerCase())
        return false;

      if (totalPrice === 0 || cb.amount === 0) return true; // Se um é 0, aceita

      const diff = Math.abs(cb.amount - totalPrice) / cb.amount;
      return diff <= 0.05; // 5% de tolerância
    });

    if (candidates.length === 0) {
      console.log(
        `[Shopify webhook] Nenhum chargeback encontrado para ${customerEmail}`
      );
      return Response.json({
        received: true,
        matched: false,
        message: `Nenhum chargeback encontrado para ${customerEmail}`,
      });
    }

    // Se múltiplos candidatos, pegar o mais recente
    const matchedChargeback = candidates.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];

    // ── Enriquecer o record ──
    matchedChargeback.shopifyOrderName = orderName;
    matchedChargeback.shopifyFulfillmentStatus = fulfillmentStatus;
    matchedChargeback.shopifyTrackingNumber = trackingNumber;
    matchedChargeback.shopifyTrackingCompany = trackingCompany;
    matchedChargeback.shopifyTrackingUrl = trackingUrl;
    matchedChargeback.shopifyWebhookEvent = topic;
    matchedChargeback.shopifyWebhookReceivedAt = new Date().toISOString();

    // ── Também atualizar rascunho para pré-preencher ──
    if (matchedChargeback.rascunho) {
      matchedChargeback.rascunho.numeroPedido = orderName;
      if (trackingNumber) {
        matchedChargeback.rascunho.codigoRastreio = trackingNumber;
      }
      if (trackingCompany) {
        matchedChargeback.rascunho.transportadora = trackingCompany;
      }
    }

    // ── Salvar de volta ──
    const updated = chargebacks.map((cb) =>
      cb.id === matchedChargeback.id ? matchedChargeback : cb
    );
    await writeStore(updated);

    console.log(
      `✅ [Shopify webhook] Chargeback ${matchedChargeback.id} enriquecido com dados de fulfillment`
    );

    return Response.json({
      received: true,
      matched: true,
      chargebackId: matchedChargeback.id,
      message: `Chargeback atualizado com dados de ${orderName}`,
    });
  } catch (error) {
    console.error("[Shopify webhook] Erro:", error);
    return Response.json({ received: true, error: "Logged internally" });
  }
}
