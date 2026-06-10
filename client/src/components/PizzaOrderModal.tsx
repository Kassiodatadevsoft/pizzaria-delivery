import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";
import { ShoppingCart, ChevronDown, ChevronUp, Pizza, Check } from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type PizzaItem = {
  id: number;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  prices: Record<string, number>;
  availableSizes: string[];
  categoryId: number;
};

// ─── Constantes ───────────────────────────────────────────────────────────────

export const SIZE_CONFIG: Record<string, { label: string; slices: string }> = {
  brotinho: { label: "Brotinho", slices: "1 fatia" },
  pequena:  { label: "Pequena",  slices: "6 fatias" },
  media:    { label: "Média",    slices: "8 fatias" },
  grande:   { label: "Grande",   slices: "10 fatias" },
  trem:     { label: "Trem",     slices: "18 fatias" },
  bitrem:   { label: "Bi-Trem",  slices: "36 fatias" },
  unico:    { label: "Único",    slices: "" },
  copo:     { label: "Copo",     slices: "" },
  jarra:    { label: "Jarra",    slices: "" },
};

// Preço da borda por tamanho (conforme cardápio)
export const CRUST_PRICES: Record<string, number> = {
  brotinho: 0,    // brotinho não tem borda
  pequena:  12,
  media:    15,
  grande:   18,
  trem:     22,
  bitrem:   30,
};

export const CRUST_OPTIONS = [
  { key: "mussarela",  label: "Mussarela" },
  { key: "cheddar",    label: "Cheddar" },
  { key: "catupiry",   label: "Catupiry" },
  { key: "4queijos",   label: "4 Queijos" },
  { key: "chocolate",  label: "Chocolate" },
];

// Tamanhos que suportam meio a meio (mínimo 6 fatias)
const HALF_HALF_SIZES = ["pequena", "media", "grande", "trem", "bitrem"];

// ─── Componente ───────────────────────────────────────────────────────────────

interface PizzaOrderModalProps {
  pizza: PizzaItem | null;
  allPizzas: PizzaItem[]; // para seleção do segundo sabor
  open: boolean;
  onClose: () => void;
}

export default function PizzaOrderModal({ pizza, allPizzas, open, onClose }: PizzaOrderModalProps) {
  const { addItem } = useCart();

  const [selectedSize, setSelectedSize] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [isHalfHalf, setIsHalfHalf] = useState(false);
  const [secondFlavor, setSecondFlavor] = useState<PizzaItem | null>(null);
  const [showSecondFlavors, setShowSecondFlavors] = useState(false);
  const [selectedCrust, setSelectedCrust] = useState<string>("");

  // Pizzas do mesmo tipo (mesma categoria) para meio a meio
  const sameCategoryPizzas = useMemo(() => {
    if (!pizza) return [];
    return allPizzas.filter((p) => p.id !== pizza.id && p.categoryId === pizza.categoryId);
  }, [pizza, allPizzas]);

  const isPizzaCategory = pizza ? HALF_HALF_SIZES.some((s) => pizza.availableSizes.includes(s)) : false;
  const canHalfHalf = isPizzaCategory && sameCategoryPizzas.length > 0 && HALF_HALF_SIZES.includes(selectedSize);
  const hasCrust = isPizzaCategory && selectedSize && selectedSize !== "brotinho" && HALF_HALF_SIZES.includes(selectedSize);
  const crustPrice = selectedSize ? (CRUST_PRICES[selectedSize] ?? 0) : 0;

  const basePrice = useMemo(() => {
    if (!pizza || !selectedSize) return 0;
    const p1 = pizza.prices[selectedSize] ?? 0;
    if (isHalfHalf && secondFlavor) {
      const p2 = secondFlavor.prices[selectedSize] ?? 0;
      return (p1 + p2) / 2; // média dos dois sabores
    }
    return p1;
  }, [pizza, selectedSize, isHalfHalf, secondFlavor]);

  const unitPrice = basePrice + (selectedCrust ? crustPrice : 0);
  const totalPrice = unitPrice * quantity;

  function handleClose() {
    setSelectedSize("");
    setQuantity(1);
    setIsHalfHalf(false);
    setSecondFlavor(null);
    setShowSecondFlavors(false);
    setSelectedCrust("");
    onClose();
  }

  function handleAddToCart() {
    if (!pizza || !selectedSize) {
      toast.error("Selecione o tamanho da pizza.");
      return;
    }
    if (isHalfHalf && !secondFlavor) {
      toast.error("Selecione o segundo sabor para o meio a meio.");
      return;
    }

    const sizeConfig = SIZE_CONFIG[selectedSize];
    const crustOption = CRUST_OPTIONS.find((c) => c.key === selectedCrust);

    const flavorName = isHalfHalf && secondFlavor
      ? `${pizza.name} / ${secondFlavor.name}`
      : pizza.name;

    addItem({
      pizzaId: pizza.id,
      pizzaName: flavorName,
      imageUrl: pizza.imageUrl ?? undefined,
      secondFlavorId: isHalfHalf && secondFlavor ? secondFlavor.id : undefined,
      secondFlavorName: isHalfHalf && secondFlavor ? secondFlavor.name : undefined,
      size: selectedSize,
      sizeLabel: sizeConfig?.label ?? selectedSize,
      crust: selectedCrust || undefined,
      crustLabel: crustOption?.label,
      crustPrice: selectedCrust ? crustPrice : undefined,
      quantity,
      unitPrice,
    });

    toast.success(`${flavorName} adicionado ao carrinho!`);
    handleClose();
  }

  if (!pizza) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl text-foreground">{pizza.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Pizza image */}
          {pizza.imageUrl && (
            <img
              src={pizza.imageUrl}
              alt={pizza.name}
              className="w-full h-44 object-cover rounded-xl"
            />
          )}

          {/* Description */}
          {pizza.description && (
            <p className="text-sm text-muted-foreground">{pizza.description}</p>
          )}

          {/* ── Tamanho ─────────────────────────────────────────────────────── */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Escolha o tamanho *</h3>
            <div className="grid grid-cols-2 gap-2">
              {pizza.availableSizes.map((size) => {
                const config = SIZE_CONFIG[size];
                const price = pizza.prices[size] ?? 0;
                const isSelected = selectedSize === size;
                return (
                  <button
                    key={size}
                    onClick={() => {
                      setSelectedSize(size);
                      // Reset meio a meio se tamanho não suportar
                      if (!HALF_HALF_SIZES.includes(size)) {
                        setIsHalfHalf(false);
                        setSecondFlavor(null);
                      }
                      // Reset borda se brotinho
                      if (size === "brotinho") setSelectedCrust("");
                    }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50 bg-card"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-sm font-semibold ${isSelected ? "text-primary" : "text-foreground"}`}>
                          {config?.label ?? size}
                        </p>
                        {config?.slices && (
                          <p className="text-xs text-muted-foreground">{config.slices}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${isSelected ? "text-primary" : "text-foreground"}`}>
                          R$ {price.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="mt-1.5 flex justify-end">
                        <Check className="w-4 h-4 text-primary" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Meio a Meio ─────────────────────────────────────────────────── */}
          {isPizzaCategory && selectedSize && canHalfHalf && (
            <div>
              <Separator className="bg-border mb-4" />
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Meio a Meio?</h3>
                  <p className="text-xs text-muted-foreground">Escolha 2 sabores diferentes</p>
                </div>
                <button
                  onClick={() => {
                    setIsHalfHalf(!isHalfHalf);
                    if (isHalfHalf) { setSecondFlavor(null); setShowSecondFlavors(false); }
                  }}
                  className={`relative w-11 h-6 rounded-full transition-colors ${isHalfHalf ? "bg-primary" : "bg-muted"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isHalfHalf ? "translate-x-5" : ""}`} />
                </button>
              </div>

              {isHalfHalf && (
                <div className="space-y-2">
                  {/* Primeiro sabor (já selecionado) */}
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/40 bg-primary/5">
                    <Pizza className="w-4 h-4 text-primary flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">1º sabor: {pizza.name}</p>
                    </div>
                    <Badge className="bg-primary/20 text-primary border-0 text-xs">Selecionado</Badge>
                  </div>

                  {/* Segundo sabor */}
                  <button
                    onClick={() => setShowSecondFlavors(!showSecondFlavors)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      secondFlavor
                        ? "border-primary/40 bg-primary/5"
                        : "border-dashed border-border hover:border-primary/50"
                    }`}
                  >
                    <Pizza className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 text-left">
                      {secondFlavor ? (
                        <p className="text-sm font-medium text-foreground">2º sabor: {secondFlavor.name}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">Escolher 2º sabor...</p>
                      )}
                    </div>
                    {showSecondFlavors ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>

                  {showSecondFlavors && (
                    <div className="max-h-48 overflow-y-auto rounded-xl border border-border bg-card/50 divide-y divide-border">
                      {sameCategoryPizzas.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => { setSecondFlavor(p); setShowSecondFlavors(false); }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-primary/5 transition-colors ${
                            secondFlavor?.id === p.id ? "bg-primary/10" : ""
                          }`}
                        >
                          <span className="flex-1 text-sm text-foreground">{p.name}</span>
                          {secondFlavor?.id === p.id && <Check className="w-4 h-4 text-primary" />}
                        </button>
                      ))}
                    </div>
                  )}

                  {isHalfHalf && secondFlavor && (
                    <p className="text-xs text-muted-foreground text-center">
                      Preço = média dos dois sabores no tamanho escolhido
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Borda Recheada ──────────────────────────────────────────────── */}
          {hasCrust && (
            <div>
              <Separator className="bg-border mb-4" />
              <h3 className="text-sm font-semibold text-foreground mb-1">
                Borda Recheada{" "}
                <span className="text-muted-foreground font-normal">
                  (+R$ {crustPrice.toFixed(2)})
                </span>
              </h3>
              <p className="text-xs text-muted-foreground mb-3">Opcional — escolha o sabor da borda</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedCrust("")}
                  className={`px-4 py-2 rounded-full text-sm border transition-all ${
                    !selectedCrust
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  Sem borda
                </button>
                {CRUST_OPTIONS.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setSelectedCrust(c.key)}
                    className={`px-4 py-2 rounded-full text-sm border transition-all ${
                      selectedCrust === c.key
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Quantidade ──────────────────────────────────────────────────── */}
          <div>
            <Separator className="bg-border mb-4" />
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Quantidade</h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-foreground hover:border-primary hover:text-primary transition-colors text-lg font-bold"
                >
                  −
                </button>
                <span className="w-8 text-center font-semibold text-foreground text-lg">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => q + 1)}
                  className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-foreground hover:border-primary hover:text-primary transition-colors text-lg font-bold"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* ── Resumo do preço ─────────────────────────────────────────────── */}
          {selectedSize && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-1.5">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Pizza ({SIZE_CONFIG[selectedSize]?.label ?? selectedSize})</span>
                <span>R$ {basePrice.toFixed(2)}</span>
              </div>
              {selectedCrust && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Borda {CRUST_OPTIONS.find((c) => c.key === selectedCrust)?.label}</span>
                  <span>+ R$ {crustPrice.toFixed(2)}</span>
                </div>
              )}
              {quantity > 1 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>× {quantity}</span>
                  <span></span>
                </div>
              )}
              <Separator className="bg-border/50" />
              <div className="flex justify-between font-bold text-foreground">
                <span>Total</span>
                <span className="text-primary text-lg">R$ {totalPrice.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* ── Botão ───────────────────────────────────────────────────────── */}
          <Button
            onClick={handleAddToCart}
            disabled={!selectedSize}
            className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-base gap-2"
          >
            <ShoppingCart className="w-5 h-5" />
            Adicionar ao Carrinho
            {selectedSize && ` — R$ ${totalPrice.toFixed(2)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
