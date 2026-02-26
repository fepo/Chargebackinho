import { getPagarmeAPI } from "@/lib/pagarme";
import { getShopifyAPI } from "@/lib/shopify";
import type { CustomerHistory } from "@/types";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email: string = (body.email ?? "").trim();

    if (!email) {
      return Response.json({ error: "email é obrigatório" }, { status: 400 });
    }

    // Busca em paralelo nas duas fontes
    const [pagarmeOrders, shopifyOrders] = await Promise.all([
      getPagarmeAPI().findOrdersByCustomerEmail(email).catch(() => []),
      (getShopifyAPI()?.getOrdersByEmail(email) ?? Promise.resolve([])).catch(() => []),
    ]);

    // Normaliza datas e valores para poder calcular totais
    type NormalizedOrder = { date: string; amountCents: number };

    const fromPagarme: NormalizedOrder[] = pagarmeOrders.map((o) => ({
      date: o.createdAt,
      amountCents: o.amount, // já em centavos
    }));

    // Shopify: totalPrice é string "150.00" em reais → converter para centavos
    const fromShopify: NormalizedOrder[] = shopifyOrders.map((o) => ({
      date: o.createdAt,
      amountCents: Math.round(parseFloat(o.totalPrice) * 100),
    }));

    const all = [...fromPagarme, ...fromShopify].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const totalOrders = all.length;
    const totalSpent = all.reduce((sum, o) => sum + o.amountCents, 0);
    const firstOrderDate = all[0]?.date ?? null;
    const lastOrderDate = all[all.length - 1]?.date ?? null;

    const history: CustomerHistory = {
      totalOrders,
      totalSpent,
      firstOrderDate,
      lastOrderDate,
    };

    return Response.json(history);
  } catch (error) {
    console.error("[clientes/historico]", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Erro interno" },
      { status: 500 }
    );
  }
}
