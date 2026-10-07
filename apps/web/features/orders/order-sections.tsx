import { DataTable, type Column } from "@/components/ui/data-table";
import { Money } from "@/components/ui/displays";
import { Identifier } from "@/components/ui/identifier";
import type { OrderItem } from "./api";

export function OrderItems({
  items,
  currency,
  platform = false,
}: {
  items: OrderItem[];
  currency: string;
  platform?: boolean;
}) {
  const amount = (
    id: keyof Pick<
      OrderItem,
      | "unit_price"
      | "tax_amount"
      | "total"
      | "commission_amount"
      | "seller_net_amount"
    >,
    heading: string,
  ): Column<OrderItem> => ({
    id,
    heading,
    align: "right",
    cell: (item) => <Money amount={item[id]} currency={currency} />,
  });
  return (
    <DataTable
      caption="Ordered items"
      rows={items}
      rowKey={(item) => item.id}
      columns={[
        {
          id: "item",
          heading: "Item",
          cell: (item) => (
            <div>
              <p className="font-medium">{item.product_name_snapshot}</p>
              <Identifier value={item.sku_snapshot} prefix="SKU: " />
            </div>
          ),
        },
        {
          id: "quantity",
          heading: "Quantity",
          align: "right",
          cell: (item) => item.quantity,
        },
        amount("unit_price", "Unit Price"),
        amount("tax_amount", "Tax"),
        amount("total", "Total"),
        ...(platform ? [amount("commission_amount", "Commission")] : []),
        amount("seller_net_amount", "Net Amount"),
      ]}
    />
  );
}

export function OrderTotals({
  values,
  currency,
  total,
  totalLabel,
}: {
  values: {
    subtotal: string;
    discount_total: string;
    tax_total: string;
    shipping_total: string;
    commission_total?: string;
  };
  currency: string;
  total: string;
  totalLabel: string;
}) {
  const lines = [
    { label: "Subtotal", value: values.subtotal },
    { label: "Discounts", value: values.discount_total, deduction: true },
    { label: "Tax", value: values.tax_total },
    { label: "Shipping", value: values.shipping_total },
    ...(values.commission_total !== undefined
      ? [
          {
            label: "Platform Commission",
            value: values.commission_total,
            deduction: true,
          },
        ]
      : []),
  ];
  return (
    <dl className="space-y-3 text-ui-body">
      {lines.map((line) => (
        <div key={line.label} className="flex flex-wrap justify-between gap-3">
          <dt className="text-ui-secondary">{line.label}</dt>
          <dd className="text-right tabular-nums">
            {line.deduction && "\u2212"}
            <Money amount={line.value} currency={currency} />
          </dd>
        </div>
      ))}
      <div className="flex flex-wrap justify-between gap-3 border-t border-ui-border pt-3 font-semibold">
        <dt>{totalLabel}</dt>
        <dd className="text-right">
          <Money amount={total} currency={currency} />
        </dd>
      </div>
    </dl>
  );
}
