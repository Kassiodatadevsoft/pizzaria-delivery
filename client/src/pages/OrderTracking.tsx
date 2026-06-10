import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Clock, ChefHat, Truck, Package, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

type OrderStatus = "received" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";

const STATUS_STEPS: { key: OrderStatus; label: string; icon: React.ReactNode; desc: string }[] = [
  { key: "received", label: "Pedido Recebido", icon: <Package className="w-5 h-5" />, desc: "Seu pedido foi confirmado" },
  { key: "preparing", label: "Em Preparo", icon: <ChefHat className="w-5 h-5" />, desc: "Nossa equipe está preparando" },
  { key: "out_for_delivery", label: "Saiu para Entrega", icon: <Truck className="w-5 h-5" />, desc: "Está a caminho!" },
  { key: "delivered", label: "Entregue", icon: <CheckCircle2 className="w-5 h-5" />, desc: "Bom apetite!" },
];

const STATUS_ORDER: Record<OrderStatus, number> = {
  received: 0,
  preparing: 1,
  out_for_delivery: 2,
  delivered: 3,
  cancelled: -1,
};

const PAYMENT_LABELS: Record<string, string> = { cash: "Dinheiro", card: "Cartão", pix: "PIX" };

export default function OrderTracking() {
  const params = useParams<{ token: string }>();
  const [, navigate] = useLocation();

  const { data, isLoading, error } = trpc.orders.byToken.useQuery(
    { token: params.token ?? "" },
    {
      enabled: !!params.token,
      refetchInterval: 15000, // Poll every 15s for real-time updates
    }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando seu pedido...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h2 className="font-serif text-2xl font-bold text-foreground mb-2">Pedido não encontrado</h2>
          <p className="text-muted-foreground mb-6">Verifique o link e tente novamente.</p>
          <Button onClick={() => navigate("/")} className="bg-primary text-primary-foreground">
            Voltar ao início
          </Button>
        </div>
      </div>
    );
  }

  const status = data.status as OrderStatus;
  const currentStep = STATUS_ORDER[status];
  const isCancelled = status === "cancelled";

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="container max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <p className="text-primary text-sm font-medium uppercase tracking-widest mb-2">
            Acompanhamento
          </p>
          <h1 className="font-serif text-3xl font-bold text-foreground mb-1">
            Pedido #{data.id}
          </h1>
          <p className="text-muted-foreground text-sm">
            Olá, <span className="text-foreground font-medium">{data.customerName}</span>! Acompanhe seu pedido abaixo.
          </p>
        </div>

        {/* Status tracker */}
        {isCancelled ? (
          <div className="bg-card rounded-2xl border border-destructive/30 p-8 text-center mb-8">
            <XCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
            <h2 className="font-serif text-xl font-bold text-foreground mb-1">Pedido Cancelado</h2>
            <p className="text-muted-foreground text-sm">
              Seu pedido foi cancelado. Entre em contato conosco se tiver dúvidas.
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-border p-8 mb-8">
            <div className="relative">
              {/* Progress line */}
              <div className="absolute top-6 left-6 right-6 h-0.5 bg-border" />
              <div
                className="absolute top-6 left-6 h-0.5 bg-primary transition-all duration-700"
                style={{
                  width: currentStep === 0 ? "0%" : `${(currentStep / (STATUS_STEPS.length - 1)) * 100}%`,
                  right: "auto",
                }}
              />

              <div className="relative flex justify-between">
                {STATUS_STEPS.map((step, idx) => {
                  const done = idx <= currentStep;
                  const active = idx === currentStep;
                  return (
                    <div key={step.key} className="flex flex-col items-center gap-2 flex-1">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                          done
                            ? "bg-primary border-primary text-primary-foreground"
                            : "bg-card border-border text-muted-foreground"
                        } ${active ? "ring-4 ring-primary/20 scale-110" : ""}`}
                      >
                        {step.icon}
                      </div>
                      <div className="text-center">
                        <p className={`text-xs font-semibold ${done ? "text-foreground" : "text-muted-foreground"}`}>
                          {step.label}
                        </p>
                        {active && (
                          <p className="text-xs text-primary mt-0.5">{step.desc}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ETA */}
            {status !== "delivered" && (
              <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground text-sm">
                <Clock className="w-4 h-4" />
                <span>Atualizado automaticamente a cada 15 segundos</span>
              </div>
            )}
          </div>
        )}

        {/* Order details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Items */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <h3 className="font-serif text-lg font-semibold text-foreground mb-4">Itens do Pedido</h3>
            <div className="space-y-3">
              {data.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground leading-tight">{item.quantity}x {item.pizzaName}</p>
                    <div className="flex flex-wrap gap-x-2 mt-0.5">
                      {item.sizeLabel && item.sizeLabel !== "Único" && (
                        <span className="text-muted-foreground text-xs">{item.sizeLabel}</span>
                      )}
                      {item.crustLabel && (
                        <span className="text-amber-500/80 text-xs">Borda {item.crustLabel}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-foreground font-medium flex-shrink-0">
                    R$ {Number(item.totalPrice).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border space-y-1">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span>R$ {Number(data.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Entrega</span>
                <span>R$ {Number(data.deliveryFee).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-foreground pt-1">
                <span>Total</span>
                <span className="text-primary">R$ {Number(data.total).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Delivery info */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <h3 className="font-serif text-lg font-semibold text-foreground mb-4">Entrega</h3>
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                <span className="text-foreground font-medium">Endereço:</span>
                <br />
                {data.addressStreet}, {data.addressNumber}
                {data.addressComplement && ` (${data.addressComplement})`}
                <br />
                {data.addressNeighborhood} — {data.addressCity}/{data.addressState}
              </p>
              <p className="text-muted-foreground">
                <span className="text-foreground font-medium">Pagamento:</span>{" "}
                {PAYMENT_LABELS[data.paymentMethod] ?? data.paymentMethod}
              </p>
              {data.customerPhone && (
                <p className="text-muted-foreground">
                  <span className="text-foreground font-medium">Telefone:</span>{" "}
                  {data.customerPhone}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="text-center mt-8">
          <Button
            variant="outline"
            onClick={() => navigate("/cardapio")}
            className="border-primary/40 text-primary hover:bg-primary/10"
          >
            Fazer novo pedido
          </Button>
        </div>
      </div>
    </div>
  );
}
