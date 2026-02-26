import { prisma } from "@/lib/db";
import { getShopifyAPI } from "@/lib/shopify";

export async function POST(request: Request) {
  try {
    const { chargebackId, orderName } = await request.json();

    if (!chargebackId) {
      return Response.json({ success: false, error: "chargebackId é obrigatório" }, { status: 400 });
    }

    // Buscar chargeback no DB
    const chargeback = await prisma.chargeback.findUnique({ where: { id: chargebackId } });
    if (!chargeback) {
      return Response.json({ success: false, error: "Chargeback não encontrado" }, { status: 404 });
    }

    const shopifyAPI = getShopifyAPI();
    if (!shopifyAPI) {
      return Response.json({
        success: false,
        error: "Shopify não configurada. Configure SHOPIFY_STORE_URL e SHOPIFY_API_ACCESS_TOKEN.",
      }, { status: 400 });
    }

    // Determinar como buscar: por orderName passado, pelo numeroPedido do chargeback, ou pelo email
    let order = null;
    const searchName = orderName || chargeback.numeroPedido;

    if (searchName) {
      order = await shopifyAPI.getOrderByName(searchName);
    }

    // Fallback: buscar por email
    if (!order && chargeback.emailCliente) {
      const orders = await shopifyAPI.getOrdersByEmail(chargeback.emailCliente);
      if (orders.length > 0) {
        // Se temos valor, tentar match por valor
        const cbValor = parseFloat(chargeback.valorTransacao ?? "0");
        if (cbValor > 0) {
          order = orders.find((o) => {
            const diff = Math.abs(parseFloat(o.totalPrice) - cbValor) / cbValor;
            return diff <= 0.05; // 5% tolerância
          }) ?? orders[0];
        } else {
          order = orders[0];
        }
      }
    }

    if (!order) {
      return Response.json({
        success: false,
        error: `Pedido não encontrado na Shopify (buscou: ${searchName || chargeback.emailCliente || "sem dados"})`,
      }, { status: 404 });
    }

    // Extrair dados de fulfillment
    const fulfillment = order.fulfillments?.[0];
    const trackingNumber = fulfillment?.trackingInfo?.number ?? null;
    const trackingCompany = fulfillment?.trackingInfo?.company ?? null;

    // Montar endereço formatado
    const addr = order.customer?.defaultAddress;
    const enderecoFormatado = addr
      ? [addr.address1, addr.address2, addr.city, addr.province, addr.zip, addr.country]
        .filter(Boolean)
        .join(", ")
      : null;

    // Montar itens como JSON
    const itensJSON = JSON.stringify(
      order.lineItems.map((item) => ({
        descricao: item.title,
        valor: `R$ ${item.price}`,
        quantidade: item.quantity,
        sku: item.sku,
      }))
    );

    // Atualizar chargeback no DB com dados da Shopify
    const updated = await prisma.chargeback.update({
      where: { id: chargebackId },
      data: {
        // Preencher campos vazios com dados da Shopify
        numeroPedido: chargeback.numeroPedido || order.name,
        nomeCliente: chargeback.nomeCliente || `${order.customer?.firstName ?? ""} ${order.customer?.lastName ?? ""}`.trim() || null,
        emailCliente: chargeback.emailCliente || order.customer?.email || order.email || null,
        enderecoEntrega: chargeback.enderecoEntrega || enderecoFormatado,
        valorTransacao: chargeback.valorTransacao || order.totalPrice,
        itensPedido: chargeback.itensPedido || itensJSON,
        transportadora: chargeback.transportadora || trackingCompany,
        codigoRastreio: chargeback.codigoRastreio || trackingNumber,
        // Sempre atualizar shopifyData com dados mais recentes
        shopifyData: JSON.stringify({
          orderId: order.id,
          orderName: order.name,
          financialStatus: order.financialStatus,
          fulfillmentStatus: order.fulfillmentStatus,
          totalPrice: order.totalPrice,
          currency: order.currency,
          customer: order.customer,
          lineItems: order.lineItems,
          fulfillments: order.fulfillments,
          tags: order.tags,
          enrichedAt: new Date().toISOString(),
        }),
      },
    });

    return Response.json({
      success: true,
      chargebackId: updated.id,
      orderName: order.name,
      fieldsUpdated: {
        numeroPedido: !chargeback.numeroPedido && !!order.name,
        nomeCliente: !chargeback.nomeCliente,
        emailCliente: !chargeback.emailCliente,
        enderecoEntrega: !chargeback.enderecoEntrega,
        transportadora: !chargeback.transportadora && !!trackingCompany,
        codigoRastreio: !chargeback.codigoRastreio && !!trackingNumber,
        shopifyData: true,
      },
    });
  } catch (error) {
    console.error("[Shopify enrich] Erro:", error);
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}
