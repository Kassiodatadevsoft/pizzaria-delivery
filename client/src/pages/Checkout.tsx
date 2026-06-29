import { useState } from "react";
import { useCart } from "@/contexts/CartContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useLocation } from "wouter";
import { ArrowLeft, CreditCard, Banknote, QrCode, CheckCircle2, Loader2, Truck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

type PaymentMethod = "cash" | "card" | "pix";
type DeliveryType = "KM 2" | "KM 100";

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: "pix", label: "PIX", icon: <QrCode className="w-5 h-5" />, desc: "Aprovação instantânea" },
  { value: "card", label: "Cartão", icon: <CreditCard className="w-5 h-5" />, desc: "Débito ou crédito" },
  { value: "cash", label: "Dinheiro", icon: <Banknote className="w-5 h-5" />, desc: "Troco na entrega" },
];

const DELIVERY_OPTIONS: { value: DeliveryType; label: string; price: number }[] = [
  { value: "KM 2", label: "KM 2", price: 5 },
  { value: "KM 100", label: "KM 100", price: 7 },
];

type CheckoutCartItem = ReturnType<typeof useCart>["items"][number];

function formatItemNameForOrder(item: CheckoutCartItem) {
  const options = item.selectedOptions?.map((option) => `${option.groupName}: ${option.choiceName}`) ?? [];
  return options.length ? `${item.pizzaName} (${options.join(", ")})` : item.pizzaName;
}

export default function Checkout() {
  const { items, subtotal, clearCart } = useCart();
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const [form, setForm] = useState({
    customerName: user?.name ?? "",
    customerPhone: "",
    addressStreet: "",
    addressNumber: "",
    addressComplement: "",
    addressNeighborhood: "",
    deliveryType: "" as DeliveryType | "",
    paymentMethod: "pix" as PaymentMethod,
    changeFor: "",
    notes: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const selectedDelivery = DELIVERY_OPTIONS.find((option) => option.value === form.deliveryType);
  const deliveryFee = selectedDelivery?.price ?? 0;
  const total = subtotal + deliveryFee;

  const createOrder = trpc.orders.create.useMutation({
    onSuccess: (data) => {
      clearCart();
      navigate(`/pedido/${data.token}`);
    },
    onError: (err) => {
      toast.error("Erro ao finalizar pedido", { description: err.message });
    },
  });

  const set = (field: string, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: "" }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.customerName.trim()) e.customerName = "Nome é obrigatório";
    if (!form.customerPhone.trim()) e.customerPhone = "Telefone é obrigatório";
    else if (!/^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/.test(form.customerPhone.replace(/\s/g, "")))
      e.customerPhone = "Telefone inválido";
    if (!form.addressStreet.trim()) e.addressStreet = "Rua é obrigatória";
    if (!form.addressNumber.trim()) e.addressNumber = "Número é obrigatório";
    if (!form.addressNeighborhood.trim()) e.addressNeighborhood = "Bairro é obrigatório";
    if (!form.deliveryType) e.deliveryType = "Selecione a Taxa de entrega";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      toast.error("Seu carrinho está vazio!");
      return;
    }
    if (!validate()) return;
    if (!form.deliveryType) return;

    createOrder.mutate({
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      addressStreet: form.addressStreet,
      addressNumber: form.addressNumber,
      addressComplement: form.addressComplement || undefined,
      addressNeighborhood: form.addressNeighborhood,
      addressCity: "Local",
      addressState: "XX",
      paymentMethod: form.paymentMethod,
      changeFor: form.changeFor ? parseFloat(form.changeFor) : undefined,
      notes: form.notes || undefined,
      deliveryType: form.deliveryType,
      items: items.map((item) => ({
        pizzaId: item.pizzaId,
        pizzaName: formatItemNameForOrder(item),
        secondFlavorId: item.secondFlavorId,
        secondFlavorName: item.secondFlavorName,
        size: item.size,
        sizeLabel: item.sizeLabel,
        crust: item.crust,
        crustPrice: item.crustPrice,
        addons: item.selectedAddons?.map((addon) => ({
          addonId: addon.addonId,
          addonName: addon.addonName,
          addonPrice: addon.addonPrice,
        })) ?? [],
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
    });
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center">
          <span className="text-6xl block mb-4">🛒</span>
          <h2 className="font-serif text-2xl font-bold text-foreground mb-2">Carrinho vazio</h2>
          <p className="text-muted-foreground mb-6">Adicione pizzas antes de finalizar o pedido.</p>
          <Button onClick={() => navigate("/cardapio")} className="bg-primary text-primary-foreground">
            Ver Cardápio
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="container max-w-5xl mx-auto">
        {/* Back */}
        <button
          onClick={() => navigate("/cardapio")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao cardápio
        </button>

        <h1 className="font-serif text-3xl font-bold text-foreground mb-8">Finalizar Pedido</h1>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* ── Left: Form ─────────────────────────────────────────── */}
            <div className="lg:col-span-2 space-y-8">
              {/* Customer info */}
              <div className="bg-card rounded-2xl border border-border p-6">
                <h2 className="font-serif text-xl font-semibold text-foreground mb-5">
                  Seus Dados
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <Label htmlFor="customerName" className="text-sm font-medium text-foreground mb-1.5 block">
                      Nome completo *
                    </Label>
                    <Input
                      id="customerName"
                      value={form.customerName}
                      onChange={(e) => set("customerName", e.target.value)}
                      placeholder="Seu nome"
                      className={`bg-input border-border ${errors.customerName ? "border-destructive" : ""}`}
                    />
                    {errors.customerName && <p className="text-destructive text-xs mt-1">{errors.customerName}</p>}
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="customerPhone" className="text-sm font-medium text-foreground mb-1.5 block">
                      Telefone / Celular *
                    </Label>
                    <Input
                      id="customerPhone"
                      value={form.customerPhone}
                      onChange={(e) => set("customerPhone", e.target.value)}
                      placeholder="(11) 99999-9999"
                      className={`bg-input border-border ${errors.customerPhone ? "border-destructive" : ""}`}
                    />
                    {errors.customerPhone && <p className="text-destructive text-xs mt-1">{errors.customerPhone}</p>}
                  </div>
                </div>
              </div>

              {/* Delivery address */}
              <div className="bg-card rounded-2xl border border-border p-6">
                <h2 className="font-serif text-xl font-semibold text-foreground mb-5">
                  Endereço de Entrega
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  <div className="sm:col-span-2">
                    <Label htmlFor="addressStreet" className="text-sm font-medium text-foreground mb-1.5 block">
                      Rua / Avenida *
                    </Label>
                    <Input
                      id="addressStreet"
                      value={form.addressStreet}
                      onChange={(e) => set("addressStreet", e.target.value)}
                      placeholder="Nome da rua"
                      className={`bg-input border-border ${errors.addressStreet ? "border-destructive" : ""}`}
                    />
                    {errors.addressStreet && <p className="text-destructive text-xs mt-1">{errors.addressStreet}</p>}
                  </div>
                  <div>
                    <Label htmlFor="addressNumber" className="text-sm font-medium text-foreground mb-1.5 block">
                      Número *
                    </Label>
                    <Input
                      id="addressNumber"
                      value={form.addressNumber}
                      onChange={(e) => set("addressNumber", e.target.value)}
                      placeholder="123"
                      className={`bg-input border-border ${errors.addressNumber ? "border-destructive" : ""}`}
                    />
                    {errors.addressNumber && <p className="text-destructive text-xs mt-1">{errors.addressNumber}</p>}
                  </div>
                  <div>
                    <Label htmlFor="addressComplement" className="text-sm font-medium text-foreground mb-1.5 block">
                      Complemento
                    </Label>
                    <Input
                      id="addressComplement"
                      value={form.addressComplement}
                      onChange={(e) => set("addressComplement", e.target.value)}
                      placeholder="Apto, bloco..."
                      className="bg-input border-border"
                    />
                  </div>
                  <div>
                    <Label htmlFor="addressNeighborhood" className="text-sm font-medium text-foreground mb-1.5 block">
                      Bairro *
                    </Label>
                    <Input
                      id="addressNeighborhood"
                      value={form.addressNeighborhood}
                      onChange={(e) => set("addressNeighborhood", e.target.value)}
                      placeholder="Seu bairro"
                      className={`bg-input border-border ${errors.addressNeighborhood ? "border-destructive" : ""}`}
                    />
                    {errors.addressNeighborhood && <p className="text-destructive text-xs mt-1">{errors.addressNeighborhood}</p>}
                  </div>

                </div>
              </div>

              {/* Delivery fee */}
              <div className="bg-card rounded-2xl border border-border p-6">
                <h2 className="font-serif text-xl font-semibold text-foreground mb-5">
                  Taxa de entrega
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {DELIVERY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => set("deliveryType", option.value)}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        form.deliveryType === option.value
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div className={`mb-2 ${form.deliveryType === option.value ? "text-primary" : "text-muted-foreground"}`}>
                        <Truck className="w-5 h-5" />
                      </div>
                      <p className={`font-semibold text-sm ${form.deliveryType === option.value ? "text-foreground" : "text-muted-foreground"}`}>
                        {option.label}
                      </p>
                      <p className="text-xs text-muted-foreground">R$ {option.price.toFixed(2)}</p>
                    </button>
                  ))}
                </div>
                {errors.deliveryType && <p className="text-destructive text-xs mt-2">{errors.deliveryType}</p>}
              </div>

              {/* Payment */}
              <div className="bg-card rounded-2xl border border-border p-6">
                <h2 className="font-serif text-xl font-semibold text-foreground mb-5">
                  Forma de Pagamento
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {PAYMENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => set("paymentMethod", opt.value)}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        form.paymentMethod === opt.value
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div className={`mb-2 ${form.paymentMethod === opt.value ? "text-primary" : "text-muted-foreground"}`}>
                        {opt.icon}
                      </div>
                      <p className={`font-semibold text-sm ${form.paymentMethod === opt.value ? "text-foreground" : "text-muted-foreground"}`}>
                        {opt.label}
                      </p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </button>
                  ))}
                </div>

                {form.paymentMethod === "cash" && (
                  <div className="mt-4">
                    <Label htmlFor="changeFor" className="text-sm font-medium text-foreground mb-1.5 block">
                      Troco para quanto?
                    </Label>
                    <Input
                      id="changeFor"
                      type="number"
                      min={total}
                      step="0.01"
                      value={form.changeFor}
                      onChange={(e) => set("changeFor", e.target.value)}
                      placeholder={`Mínimo R$ ${total.toFixed(2)}`}
                      className="bg-input border-border max-w-xs"
                    />
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="bg-card rounded-2xl border border-border p-6">
                <h2 className="font-serif text-xl font-semibold text-foreground mb-3">
                  Observações
                </h2>
                <textarea
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Alguma observação sobre o pedido? (opcional)"
                  rows={3}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
              </div>
            </div>

            {/* ── Right: Order summary ────────────────────────────────── */}
            <div className="lg:col-span-1">
              <div className="bg-card rounded-2xl border border-border p-6 sticky top-24">
                <h2 className="font-serif text-xl font-semibold text-foreground mb-5">
                  Resumo do Pedido
                </h2>

                <div className="space-y-3 mb-4">
                  {items.map((item) => (
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
                          {item.selectedOptions?.map((option) => (
                            <span key={option.groupId} className="text-muted-foreground text-xs">
                              {option.groupName}: {option.choiceName}
                            </span>
                          ))}
                        </div>
                        {item.selectedAddons && item.selectedAddons.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {item.selectedAddons.map((addon) => (
                              <p key={addon.addonId} className="text-muted-foreground text-xs">
                                + {addon.addonName} - R$ {addon.addonPrice.toFixed(2)}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-foreground font-medium flex-shrink-0">
                        R$ {item.totalPrice.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                <Separator className="my-4" />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>R$ {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Taxa de entrega{form.deliveryType ? `: ${form.deliveryType}` : ""}</span>
                    <span>R$ {deliveryFee.toFixed(2)}</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between font-bold text-base text-foreground">
                    <span>Total</span>
                    <span className="text-primary">R$ {total.toFixed(2)}</span>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={createOrder.isPending}
                  className="w-full mt-6 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold h-12 text-base"
                >
                  {createOrder.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Confirmar Pedido
                    </>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center mt-3">
                  Ao confirmar, você receberá um link para acompanhar seu pedido.
                </p>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
