import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ChefHat, Eye, Printer, RefreshCw, Search, Truck } from "lucide-react";

type OrderStatus = "received" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";

const STATUS_LABELS: Record<OrderStatus, string> = {
  received: "Recebido",
  preparing: "Em preparo",
  out_for_delivery: "Saiu para entrega",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const STATUS_NEXT: Record<OrderStatus, OrderStatus | null> = {
  received: "preparing",
  preparing: "out_for_delivery",
  out_for_delivery: "delivered",
  delivered: null,
  cancelled: null,
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Dinheiro",
  card: "Cartao",
  pix: "PIX",
};

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

function getDeliveryLabel(order: { deliveryType?: string | null; deliveryFee?: unknown }) {
  const type = order.deliveryType || (Number(order.deliveryFee) === 7 ? "KM 100" : "KM 2");
  return `${type} - ${formatCurrency(order.deliveryFee)}`;
}

function printDocument(title: string, body: string, width = "80mm") {
  const printWindow = window.open("", "_blank", "width=420,height=720");
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
          @page { size: ${width} auto; margin: 4mm; }
          * { box-sizing: border-box; }
          body { width: ${width}; margin: 0; color: #000; font-family: Consolas, "Courier New", monospace; font-size: 12px; }
          .center { text-align: center; }
          .right { text-align: right; }
          .bold { font-weight: 700; }
          .line { border-top: 1px dashed #000; margin: 8px 0; }
          .row { display: flex; justify-content: space-between; gap: 8px; }
          .muted { font-size: 11px; }
          .large { font-size: 14px; }
          h1 { font-size: 16px; margin: 0 0 4px; }
          p { margin: 2px 0; }
          @media print { body { width: ${width}; } }
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

export default function AdminDelivery() {
  const utils = trpc.useUtils();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [search, setSearch] = useState("");

  const { data: orders, isLoading, refetch } = trpc.orders.all.useQuery();
  const { data: orderDetail } = trpc.orders.getWithItems.useQuery(
    { id: selectedId! },
    { enabled: selectedId != null }
  );

  const updateStatus = trpc.orders.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado");
      utils.orders.all.invalidate();
      if (selectedId) utils.orders.getWithItems.invalidate({ id: selectedId });
    },
    onError: (err) => toast.error("Erro ao atualizar pedido", { description: err.message }),
  });

  const stats = useMemo(() => {
    const base: Record<OrderStatus, number> = {
      received: 0,
      preparing: 0,
      out_for_delivery: 0,
      delivered: 0,
      cancelled: 0,
    };

    for (const order of orders ?? []) {
      if (order.status in base) base[order.status as OrderStatus] += 1;
    }

    return base;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (orders ?? []).filter((order) => {
      const status = order.status as OrderStatus;
      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "active" && !["delivered", "cancelled"].includes(status)) ||
        status === filterStatus;

      const matchesSearch =
        !term ||
        String(order.id).includes(term) ||
        order.customerName.toLowerCase().includes(term) ||
        (order.customerPhone ?? "").toLowerCase().includes(term) ||
        order.addressNeighborhood.toLowerCase().includes(term);

      return matchesStatus && matchesSearch;
    });
  }, [filterStatus, orders, search]);

  function printCoupon() {
    if (!orderDetail) return;

    const itemsHtml = orderDetail.items
      .map((item) => `
        <p class="bold">${escapeHtml(item.quantity)}x ${escapeHtml(item.pizzaName)}</p>
        <div class="row muted">
          <span>${escapeHtml(item.sizeLabel)}${item.crustLabel ? ` - Borda ${escapeHtml(item.crustLabel)}` : ""}</span>
          <span>${formatCurrency(item.totalPrice)}</span>
        </div>
      `)
      .join("");

    printDocument(
      `Pedido ${orderDetail.id}`,
      `
        <div class="center">
          <h1>PIZZARIA PRIME</h1>
          <p class="bold">PEDIDO #${escapeHtml(orderDetail.id)}</p>
          <p>${escapeHtml(new Date(orderDetail.createdAt).toLocaleString("pt-BR"))}</p>
        </div>
        <div class="line"></div>
        <p class="bold">Cliente</p>
        <p>${escapeHtml(orderDetail.customerName)}</p>
        ${orderDetail.customerPhone ? `<p>${escapeHtml(orderDetail.customerPhone)}</p>` : ""}
        <div class="line"></div>
        <p class="bold">Endereco</p>
        <p>${escapeHtml(orderDetail.addressStreet)}, ${escapeHtml(orderDetail.addressNumber)}</p>
        ${orderDetail.addressComplement ? `<p>${escapeHtml(orderDetail.addressComplement)}</p>` : ""}
        <p>${escapeHtml(orderDetail.addressNeighborhood)} - ${escapeHtml(orderDetail.addressCity)}/${escapeHtml(orderDetail.addressState)}</p>
        ${orderDetail.addressZip ? `<p>CEP ${escapeHtml(orderDetail.addressZip)}</p>` : ""}
        <div class="line"></div>
        <p class="bold">Itens</p>
        ${itemsHtml}
        <div class="line"></div>
        <div class="row"><span>Subtotal</span><span>${formatCurrency(orderDetail.subtotal)}</span></div>
        <div class="row"><span>TAXA DE ENTREGA</span><span>${escapeHtml(getDeliveryLabel(orderDetail))}</span></div>
        <div class="row bold"><span>Total</span><span>${formatCurrency(orderDetail.total)}</span></div>
        <div class="line"></div>
        <p><span class="bold">Pagamento:</span> ${escapeHtml(PAYMENT_LABELS[orderDetail.paymentMethod] ?? orderDetail.paymentMethod)}</p>
        ${orderDetail.changeFor ? `<p><span class="bold">Troco:</span> ${formatCurrency(orderDetail.changeFor)}</p>` : ""}
        <p><span class="bold">Status:</span> ${escapeHtml(STATUS_LABELS[orderDetail.status as OrderStatus] ?? orderDetail.status)}</p>
        ${orderDetail.notes ? `<div class="line"></div><p class="bold">Observacoes</p><p>${escapeHtml(orderDetail.notes)}</p>` : ""}
        <div class="line"></div>
        <p class="center">Obrigado pela preferencia!</p>
      `
    );
  }

  function printKitchenOrder() {
    if (!orderDetail) return;

    const itemsHtml = orderDetail.items
      .map((item) => `
        <p class="bold large">${escapeHtml(item.quantity)}x ${escapeHtml(item.pizzaName)}</p>
        <p class="muted">${escapeHtml(item.sizeLabel)}${item.crustLabel ? ` - Borda ${escapeHtml(item.crustLabel)}` : ""}</p>
      `)
      .join("");

    printDocument(
      `Cozinha pedido ${orderDetail.id}`,
      `
        <div class="center">
          <h1>COZINHA</h1>
          <p class="bold large">PEDIDO #${escapeHtml(orderDetail.id)}</p>
          <p>${escapeHtml(new Date(orderDetail.createdAt).toLocaleString("pt-BR"))}</p>
        </div>
        <div class="line"></div>
        <p><span class="bold">Cliente:</span> ${escapeHtml(orderDetail.customerName)}</p>
        <p><span class="bold">Telefone:</span> ${escapeHtml(orderDetail.customerPhone || "-")}</p>
        <p><span class="bold">Status:</span> ${escapeHtml(STATUS_LABELS[orderDetail.status as OrderStatus] ?? orderDetail.status)}</p>
        <div class="line"></div>
        <p class="bold center">ITENS PARA PREPARO</p>
        ${itemsHtml}
        ${
          orderDetail.notes
            ? `<div class="line"></div><p class="bold large">OBSERVACOES DO PEDIDO</p><p class="large">${escapeHtml(orderDetail.notes)}</p>`
            : ""
        }
        <div class="line"></div>
        <p class="bold">Entrega</p>
        <p>${escapeHtml(orderDetail.addressStreet)}, ${escapeHtml(orderDetail.addressNumber)}</p>
        ${orderDetail.addressComplement ? `<p>${escapeHtml(orderDetail.addressComplement)}</p>` : ""}
        <p>${escapeHtml(orderDetail.addressNeighborhood)} - ${escapeHtml(orderDetail.addressCity)}/${escapeHtml(orderDetail.addressState)}</p>
      `
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Truck className="w-6 h-6 text-primary" />
            Delivery Online
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Acompanhe os pedidos recebidos pelo delivery.</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} className="border-border gap-2">
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {Object.entries(STATUS_LABELS).map(([status, label]) => (
          <Card key={status} className="rounded-lg">
            <CardHeader className="p-4 pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-2xl font-bold text-foreground">{stats[status as OrderStatus]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por pedido, cliente, telefone ou bairro"
            className="pl-9 bg-card border-border"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full md:w-56 bg-card border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="active">Em andamento</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(STATUS_LABELS).map(([status, label]) => (
              <SelectItem key={status} value={status}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-24 rounded-lg bg-card animate-pulse" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center text-muted-foreground">
          Nenhum pedido de delivery encontrado.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const status = order.status as OrderStatus;
            const nextStatus = STATUS_NEXT[status];

            return (
              <div key={order.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">Pedido #{order.id}</span>
                      <Badge variant="secondary" className={`status-${status}`}>
                        {STATUS_LABELS[status] ?? order.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(order.createdAt).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <p className="mt-2 font-medium text-foreground">{order.customerName}</p>
                    <p className="text-sm text-muted-foreground">
                      {order.addressStreet}, {order.addressNumber} - {order.addressNeighborhood}, {order.addressCity}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod} - R$ {Number(order.total).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedId(order.id)} className="border-border gap-2">
                      <Eye className="w-4 h-4" />
                      Detalhes
                    </Button>
                    {nextStatus && (
                      <Button
                        size="sm"
                        onClick={() => updateStatus.mutate({ id: order.id, status: nextStatus })}
                        disabled={updateStatus.isPending}
                      >
                        Marcar: {STATUS_LABELS[nextStatus]}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={selectedId != null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3">
              <DialogTitle>Pedido #{orderDetail?.id}</DialogTitle>
              {orderDetail && (
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={printKitchenOrder} className="border-border gap-2">
                    <ChefHat className="w-4 h-4" />
                    Enviar cozinha
                  </Button>
                  <Button variant="outline" size="sm" onClick={printCoupon} className="border-border gap-2">
                    <Printer className="w-4 h-4" />
                    Imprimir cupom
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>
          {orderDetail && (
            <div className="space-y-4 text-sm">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="font-semibold text-foreground">Cliente</p>
                  <p className="text-muted-foreground">{orderDetail.customerName}</p>
                  {orderDetail.customerPhone && <p className="text-muted-foreground">{orderDetail.customerPhone}</p>}
                </div>
                <div>
                  <p className="font-semibold text-foreground">Pagamento</p>
                  <p className="text-muted-foreground">{PAYMENT_LABELS[orderDetail.paymentMethod] ?? orderDetail.paymentMethod}</p>
                  {orderDetail.changeFor && <p className="text-muted-foreground">Troco para R$ {Number(orderDetail.changeFor).toFixed(2)}</p>}
                </div>
              </div>

              <div>
                <p className="font-semibold text-foreground">Endereco</p>
                <p className="text-muted-foreground">
                  {orderDetail.addressStreet}, {orderDetail.addressNumber}
                  {orderDetail.addressComplement && ` (${orderDetail.addressComplement})`}
                  <br />
                  {orderDetail.addressNeighborhood} - {orderDetail.addressCity}/{orderDetail.addressState}
                  {orderDetail.addressZip && ` - CEP ${orderDetail.addressZip}`}
                </p>
              </div>

              <Separator />

              <div>
                <p className="font-semibold text-foreground mb-2">Itens</p>
                <div className="space-y-2">
                  {orderDetail.items.map((item) => (
                    <div key={item.id} className="flex justify-between gap-3">
                      <div>
                        <p className="text-foreground">
                          {item.quantity}x {item.pizzaName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.sizeLabel}
                          {item.crustLabel ? ` - Borda ${item.crustLabel}` : ""}
                        </p>
                      </div>
                      <span className="text-foreground">R$ {Number(item.totalPrice).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>R$ {Number(orderDetail.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Taxa de entrega</span>
                  <span>{getDeliveryLabel(orderDetail)}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-foreground">
                  <span>Total</span>
                  <span className="text-primary">R$ {Number(orderDetail.total).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-foreground">Status</p>
                  <p className="text-muted-foreground">{STATUS_LABELS[orderDetail.status as OrderStatus] ?? orderDetail.status}</p>
                </div>
                <Select
                  value={orderDetail.status}
                  onValueChange={(value) => updateStatus.mutate({ id: orderDetail.id, status: value as OrderStatus })}
                >
                  <SelectTrigger className="w-full sm:w-56 bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {Object.entries(STATUS_LABELS).map(([status, label]) => (
                      <SelectItem key={status} value={status}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {orderDetail.notes && (
                <div>
                  <p className="font-semibold text-foreground">Observacoes</p>
                  <p className="text-muted-foreground">{orderDetail.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
