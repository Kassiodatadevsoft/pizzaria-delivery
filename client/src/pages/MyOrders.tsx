import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Package, ArrowRight } from "lucide-react";
import { getLoginUrl } from "@/const";

const STATUS_LABELS: Record<string, string> = {
  received: "Recebido",
  preparing: "Em Preparo",
  out_for_delivery: "Saiu para Entrega",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

export default function MyOrders() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const { data: orders, isLoading } = trpc.orders.myOrders.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  if (loading || isLoading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center">
          <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-serif text-2xl font-bold text-foreground mb-2">Faça login para ver seus pedidos</h2>
          <p className="text-muted-foreground mb-6">Acesse sua conta para visualizar o histórico de pedidos.</p>
          <Button
            onClick={() => window.location.href = getLoginUrl()}
            className="bg-primary text-primary-foreground"
          >
            Entrar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="container max-w-3xl mx-auto">
        <h1 className="font-serif text-3xl font-bold text-foreground mb-8">Meus Pedidos</h1>

        {!orders || orders.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="font-serif text-xl font-semibold text-foreground mb-2">Nenhum pedido ainda</h2>
            <p className="text-muted-foreground mb-6">Faça seu primeiro pedido!</p>
            <Button onClick={() => navigate("/cardapio")} className="bg-primary text-primary-foreground">
              Ver Cardápio
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-card rounded-2xl border border-border p-6 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-foreground">Pedido #{order.id}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full border status-${order.status}`}>
                        {STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {new Date(order.createdAt).toLocaleString("pt-BR")}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {order.addressStreet}, {order.addressNumber} — {order.addressCity}/{order.addressState}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-primary font-bold text-lg">R$ {Number(order.total).toFixed(2)}</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(`/pedido/${order.token}`)}
                      className="text-primary hover:bg-primary/10 mt-1"
                    >
                      Acompanhar
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
