import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Eye, RefreshCw } from "lucide-react";

type OrderStatus = "received" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";

const STATUS_LABELS: Record<OrderStatus, string> = {
  received: "Recebido",
  preparing: "Em Preparo",
  out_for_delivery: "Saiu para Entrega",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const STATUS_NEXT: Record<string, OrderStatus | null> = {
  received: "preparing",
  preparing: "out_for_delivery",
  out_for_delivery: "delivered",
  delivered: null,
  cancelled: null,
};

const PAYMENT_LABELS: Record<string, string> = { cash: "Dinheiro", card: "Cartão", pix: "PIX" };

export default function AdminOrders() {
  const utils = trpc.useUtils();
  const { data: orders, isLoading, refetch } = trpc.orders.all.useQuery();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: orderDetail } = trpc.orders.getWithItems.useQuery(
    { id: selectedId! },
    { enabled: !!selectedId }
  );

  const updateStatus = trpc.orders.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado!");
      utils.orders.all.invalidate();
      if (selectedId) utils.orders.getWithItems.invalidate({ id: selectedId });
    },
    onError: (err) => toast.error("Erro ao atualizar", { description: err.message }),
  });

  const filtered = filterStatus === "all"
    ? orders
    : orders?.filter((o) => o.status === filterStatus);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl font-bold text-foreground">Pedidos</h1>
        <div className="flex items-center gap-3">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-44 bg-card border-border">
              <SelectValue placeholder="Filtrar status" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()} className="border-border">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-card rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !filtered || filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p>Nenhum pedido encontrado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const nextStatus = STATUS_NEXT[order.status];
            return (
              <div
                key={order.id}
                className="bg-card rounded-xl border border-border p-5 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-semibold text-foreground">#{order.id}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border status-${order.status}`}>
                      {STATUS_LABELS[order.status as OrderStatus] ?? order.status}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(order.createdAt).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <p className="text-sm text-foreground mt-1 font-medium">{order.customerName}</p>
                  <p className="text-xs text-muted-foreground">
                    {order.addressStreet}, {order.addressNumber} — {order.addressNeighborhood}, {order.addressCity}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod} · R$ {Number(order.total).toFixed(2)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedId(order.id)}
                    className="border-border"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Detalhes
                  </Button>
                  {nextStatus && (
                    <Button
                      size="sm"
                      onClick={() => updateStatus.mutate({ id: order.id, status: nextStatus })}
                      disabled={updateStatus.isPending}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      → {STATUS_LABELS[nextStatus]}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-foreground">
              Pedido #{orderDetail?.id}
            </DialogTitle>
          </DialogHeader>
          {orderDetail && (
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-semibold text-foreground mb-1">Cliente</p>
                <p className="text-muted-foreground">{orderDetail.customerName}</p>
                {orderDetail.customerPhone && (
                  <p className="text-muted-foreground">{orderDetail.customerPhone}</p>
                )}
              </div>
              <div>
                <p className="font-semibold text-foreground mb-1">Endereço</p>
                <p className="text-muted-foreground">
                  {orderDetail.addressStreet}, {orderDetail.addressNumber}
                  {orderDetail.addressComplement && ` (${orderDetail.addressComplement})`}
                  <br />
                  {orderDetail.addressNeighborhood} — {orderDetail.addressCity}/{orderDetail.addressState}
                  {orderDetail.addressZip && ` — CEP: ${orderDetail.addressZip}`}
                </p>
              </div>
              <Separator />
              <div>
                <p className="font-semibold text-foreground mb-2">Itens</p>
                <div className="space-y-2">
                  {orderDetail.items.map((item) => (
                    <div key={item.id} className="flex justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-muted-foreground text-sm leading-tight">
                          {item.quantity}x {item.pizzaName}
                        </p>
                        <div className="flex flex-wrap gap-x-2">
                          {item.sizeLabel && item.sizeLabel !== "Único" && (
                            <span className="text-xs text-muted-foreground/70">{item.sizeLabel}</span>
                          )}
                          {item.crustLabel && (
                            <span className="text-xs text-amber-500/80">Borda {item.crustLabel}</span>
                          )}
                        </div>
                      </div>
                      <span className="text-foreground text-sm flex-shrink-0">R$ {Number(item.totalPrice).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-border space-y-1">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span><span>R$ {Number(orderDetail.subtotal).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Entrega</span><span>R$ {Number(orderDetail.deliveryFee).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-foreground">
                    <span>Total</span><span className="text-primary">R$ {Number(orderDetail.total).toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-foreground">Pagamento</p>
                  <p className="text-muted-foreground">{PAYMENT_LABELS[orderDetail.paymentMethod] ?? orderDetail.paymentMethod}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-foreground">Status</p>
                  <Select
                    value={orderDetail.status}
                    onValueChange={(val) =>
                      updateStatus.mutate({ id: orderDetail.id, status: val as OrderStatus })
                    }
                  >
                    <SelectTrigger className="w-44 bg-input border-border mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {Object.entries(STATUS_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {orderDetail.notes && (
                <div>
                  <p className="font-semibold text-foreground">Observações</p>
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
