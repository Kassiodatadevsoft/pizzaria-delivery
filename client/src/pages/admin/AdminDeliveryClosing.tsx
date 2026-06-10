import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, ReceiptText } from "lucide-react";
import { toast } from "sonner";

type OrderStatus = "received" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";

const STATUS_LABELS: Record<OrderStatus, string> = {
  received: "Recebido",
  preparing: "Em preparo",
  out_for_delivery: "Saiu para entrega",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Dinheiro",
  card: "Cartao",
  pix: "PIX",
};

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatCurrency(value: unknown) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function printReport(title: string, body: string) {
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) {
    toast.error("Nao foi possivel abrir a janela de impressao");
    return;
  }

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          @page { size: A4; margin: 12mm; }
          body { color: #000; font-family: Arial, sans-serif; font-size: 12px; }
          h1 { font-size: 20px; margin: 0 0 4px; }
          h2 { font-size: 14px; margin: 18px 0 8px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border-bottom: 1px solid #ccc; padding: 6px 4px; text-align: left; }
          th { background: #eee; }
          .right { text-align: right; }
          .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 14px; }
          .box { border: 1px solid #999; padding: 8px; }
          .muted { color: #555; }
        </style>
      </head>
      <body>${body}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
}

export default function AdminDeliveryClosing() {
  const [dateFrom, setDateFrom] = useState(todayInputValue());
  const [dateTo, setDateTo] = useState(todayInputValue());
  const [statusFilter, setStatusFilter] = useState<string>("cashier");
  const { data: orders, isLoading } = trpc.orders.all.useQuery();

  const filteredOrders = useMemo(() => {
    const start = new Date(`${dateFrom}T00:00:00`);
    const end = new Date(`${dateTo}T23:59:59.999`);

    return (orders ?? []).filter((order) => {
      const createdAt = new Date(order.createdAt);
      const status = order.status as OrderStatus;
      const matchesDate = createdAt >= start && createdAt <= end;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "cashier" && status !== "cancelled") ||
        status === statusFilter;

      return matchesDate && matchesStatus;
    });
  }, [dateFrom, dateTo, orders, statusFilter]);

  const totals = useMemo(() => {
    const byPayment: Record<string, { count: number; total: number }> = {};
    const byStatus: Record<string, { count: number; total: number }> = {};
    let total = 0;

    for (const order of filteredOrders) {
      const value = Number(order.total);
      total += value;
      const payment = order.paymentMethod;
      const status = order.status;

      byPayment[payment] ??= { count: 0, total: 0 };
      byPayment[payment].count += 1;
      byPayment[payment].total += value;

      byStatus[status] ??= { count: 0, total: 0 };
      byStatus[status].count += 1;
      byStatus[status].total += value;
    }

    return { byPayment, byStatus, count: filteredOrders.length, total };
  }, [filteredOrders]);

  function handlePrint() {
    const paymentRows = Object.entries(totals.byPayment)
      .map(([payment, data]) => `
        <tr>
          <td>${escapeHtml(PAYMENT_LABELS[payment] ?? payment)}</td>
          <td class="right">${data.count}</td>
          <td class="right">${formatCurrency(data.total)}</td>
        </tr>
      `)
      .join("");

    const statusRows = Object.entries(totals.byStatus)
      .map(([status, data]) => `
        <tr>
          <td>${escapeHtml(STATUS_LABELS[status as OrderStatus] ?? status)}</td>
          <td class="right">${data.count}</td>
          <td class="right">${formatCurrency(data.total)}</td>
        </tr>
      `)
      .join("");

    const orderRows = filteredOrders
      .map((order) => `
        <tr>
          <td>#${escapeHtml(order.id)}</td>
          <td>${escapeHtml(new Date(order.createdAt).toLocaleString("pt-BR"))}</td>
          <td>${escapeHtml(order.customerName)}</td>
          <td>${escapeHtml(PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod)}</td>
          <td>${escapeHtml(STATUS_LABELS[order.status as OrderStatus] ?? order.status)}</td>
          <td class="right">${formatCurrency(order.total)}</td>
        </tr>
      `)
      .join("");

    printReport(
      "Fechamento Delivery",
      `
        <h1>Fechamento Delivery</h1>
        <p class="muted">Periodo: ${escapeHtml(dateFrom)} ate ${escapeHtml(dateTo)}</p>
        <p class="muted">Emitido em: ${escapeHtml(new Date().toLocaleString("pt-BR"))}</p>
        <div class="summary">
          <div class="box"><strong>Pedidos</strong><br>${totals.count}</div>
          <div class="box"><strong>Total</strong><br>${formatCurrency(totals.total)}</div>
          <div class="box"><strong>Ticket medio</strong><br>${formatCurrency(totals.count ? totals.total / totals.count : 0)}</div>
          <div class="box"><strong>Filtro</strong><br>${escapeHtml(statusFilter)}</div>
        </div>
        <h2>Por pagamento</h2>
        <table><thead><tr><th>Pagamento</th><th class="right">Qtd</th><th class="right">Total</th></tr></thead><tbody>${paymentRows}</tbody></table>
        <h2>Por status</h2>
        <table><thead><tr><th>Status</th><th class="right">Qtd</th><th class="right">Total</th></tr></thead><tbody>${statusRows}</tbody></table>
        <h2>Pedidos</h2>
        <table>
          <thead><tr><th>Pedido</th><th>Data</th><th>Cliente</th><th>Pagamento</th><th>Status</th><th class="right">Total</th></tr></thead>
          <tbody>${orderRows}</tbody>
        </table>
      `
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ReceiptText className="w-6 h-6 text-primary" />
            Fechamento Delivery
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Confira totais dos pedidos online para fechamento do caixa.</p>
        </div>
        <Button onClick={handlePrint} className="gap-2">
          <Printer className="w-4 h-4" />
          Imprimir relatorio
        </Button>
      </div>

      <Card className="rounded-lg">
        <CardContent className="p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <label className="text-xs text-muted-foreground">Data inicial</label>
              <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="bg-card border-border" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Data final</label>
              <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="bg-card border-border" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-card border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="cashier">Fechamento, sem cancelados</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([status, label]) => (
                    <SelectItem key={status} value={status}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Total do periodo</p>
              <p className="text-xl font-bold text-primary">{formatCurrency(totals.total)}</p>
              <p className="text-xs text-muted-foreground">{totals.count} pedidos</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="rounded-lg md:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Por pagamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(totals.byPayment).length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem pedidos no periodo.</p>
            ) : (
              Object.entries(totals.byPayment).map(([payment, data]) => (
                <div key={payment} className="flex justify-between text-sm">
                  <span>{PAYMENT_LABELS[payment] ?? payment} ({data.count})</span>
                  <strong>{formatCurrency(data.total)}</strong>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Pedidos do periodo</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-24 rounded bg-muted animate-pulse" />
            ) : filteredOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum pedido encontrado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="py-2 text-left">Pedido</th>
                      <th className="py-2 text-left">Cliente</th>
                      <th className="py-2 text-left">Pagamento</th>
                      <th className="py-2 text-left">Status</th>
                      <th className="py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="border-b border-border/60">
                        <td className="py-2">#{order.id}</td>
                        <td className="py-2">{order.customerName}</td>
                        <td className="py-2">{PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}</td>
                        <td className="py-2">{STATUS_LABELS[order.status as OrderStatus] ?? order.status}</td>
                        <td className="py-2 text-right font-medium">{formatCurrency(order.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
