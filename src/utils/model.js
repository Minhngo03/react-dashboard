export const joinDataModel = (dims, facts) => {
  const { dim_date, dim_product, dim_channel, dim_customer } = dims;
  const { fact_orders } = facts;

  const dateMap = Object.fromEntries(dim_date.map((d) => [d.DateKey, d]));
  const productMap = Object.fromEntries(dim_product.map((p) => [p.ProductKey, p]));
  const channelMap = Object.fromEntries(dim_channel.map((c) => [c.ChannelKey, c]));
  const customerMap = Object.fromEntries(dim_customer.map((c) => [c.CustomerKey, c]));

  const enrichedOrders = fact_orders.map((o) => ({
    ...o,
    date: dateMap[o.DateKey],
    product: productMap[o.ProductKey],
    channel: channelMap[o.ChannelKey],
    customer: customerMap[o.CustomerKey],
  }));

  return { orders: enrichedOrders };
};
