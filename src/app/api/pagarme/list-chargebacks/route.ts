import { getPagarmeAPI } from "@/lib/pagarme";

/**
 * GET /api/pagarme/list-chargebacks
 * Lista todas as contestações abertas do Pagar.me
 */
export async function GET(req: Request) {
  try {
    const apiKey = process.env.PAGARME_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "PAGARME_API_KEY não configurado" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const pagarme = getPagarmeAPI();
    const chargebacks = await pagarme.getOpenChargebacks("opened");

    // Enriquece com dados do pedido
    const enriched = await Promise.all(
      chargebacks.map(async (cb) => {
        try {
          const order = await pagarme.getCharge(cb.chargeId);
          const orderId = order.order_id;

          let orderData = null;
          if (orderId) {
            orderData = await pagarme.getOrder(orderId);
          }

          return {
            id: cb.id,
            chargeId: cb.chargeId,
            status: cb.status,
            amount: cb.amount / 100,
            reason: cb.reason,
            createdAt: cb.createdAt,
            orderId: orderId,
            customerName: orderData?.customer?.name || "Desconhecido",
            customerEmail: orderData?.customer?.email || "",
          };
        } catch (error) {
          return {
            id: cb.id,
            chargeId: cb.chargeId,
            status: cb.status,
            amount: cb.amount / 100,
            reason: cb.reason,
            createdAt: cb.createdAt,
            orderId: null,
            customerName: "Desconhecido",
            customerEmail: "",
          };
        }
      })
    );

    return new Response(JSON.stringify(enriched), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro ao listar chargebacks:", error);
    return new Response(
      JSON.stringify({
        error: "Erro ao buscar contestações",
        message: String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
