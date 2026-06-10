import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { ShoppingCart, Settings2 } from "lucide-react";
import { toast } from "sonner";
import PizzaOrderModal, { PizzaItem, SIZE_CONFIG } from "./PizzaOrderModal";

// Tamanhos que indicam que o item é uma pizza (suporta meio a meio / borda)
const PIZZA_SIZES = ["brotinho", "pequena", "media", "grande", "trem", "bitrem"];

function isPizzaProduct(sizes: string[]): boolean {
  return sizes.some((s) => PIZZA_SIZES.includes(s));
}

function getProductEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("hambúrguer") || n.includes("burger") || n.includes("barca") || n.includes("sinistro") || n.includes("humilde") || n.includes("tropical") || n.includes("moral") || n.includes("spicy") || n.includes("delícia") || n.includes("daora") || n.includes("tanto") || n.includes("qualquer") || n.includes("prime duplo") || n.includes("a 1000")) return "🍔";
  if (n.includes("batata") || n.includes("mandioca") || n.includes("cebola")) return "🍟";
  if (n.includes("frango") || n.includes("tulipa")) return "🍗";
  if (n.includes("picanha") || n.includes("filé") || n.includes("strogonoff") || n.includes("tilápia")) return "🥩";
  if (n.includes("coca") || n.includes("guaraná") || n.includes("fanta") || n.includes("sprite")) return "🥤";
  if (n.includes("água") || n.includes("h2o")) return "💧";
  if (n.includes("suco") || n.includes("maracujá") || n.includes("cajá") || n.includes("abacax") || n.includes("caju") || n.includes("cupuaçu") || n.includes("graviola") || n.includes("goiaba")) return "🧃";
  if (n.includes("cerveja") || n.includes("chopp") || n.includes("brahma") || n.includes("skol") || n.includes("heineken") || n.includes("stella") || n.includes("corona") || n.includes("spaten") || n.includes("balde")) return "🍺";
  if (n.includes("abacaxi") || n.includes("aperitivo") || n.includes("cachaça")) return "🍹";
  if (n.includes("creme")) return "🍮";
  return "🍕";
}

interface PizzaCardProps {
  pizza: {
    id: number;
    name: string;
    description?: string | null;
    imageUrl?: string | null;
    prices: unknown;
    availableSizes: unknown;
    featured?: boolean;
    categoryId: number;
  };
  allPizzas: PizzaCardProps["pizza"][];
}

export default function PizzaCard({ pizza, allPizzas }: PizzaCardProps) {
  const prices = pizza.prices as Record<string, number>;
  const sizes = pizza.availableSizes as string[];
  const { addItem } = useCart();
  const [modalOpen, setModalOpen] = useState(false);

  const isMultiSize = sizes.length > 1;
  const isSinglePrice = sizes.length === 1;
  const isPizza = isPizzaProduct(sizes);
  const firstPrice = Object.values(prices)[0] ?? 0;
  const firstSize = sizes[0] ?? "unico";

  // Para itens de preço único sem variação, adiciona direto ao carrinho
  function handleDirectAdd() {
    const sizeLabel = SIZE_CONFIG[firstSize]?.label ?? firstSize;
    addItem({
      pizzaId: pizza.id,
      pizzaName: pizza.name,
      imageUrl: pizza.imageUrl ?? undefined,
      size: firstSize,
      sizeLabel,
      quantity: 1,
      unitPrice: firstPrice,
    });
    toast.success(`${pizza.name} adicionado ao carrinho!`, {
      description: `R$ ${firstPrice.toFixed(2)}`,
    });
  }

  // Para pizzas e itens com múltiplos tamanhos, abre o modal
  function handleOpenModal() {
    setModalOpen(true);
  }

  const pizzaItem: PizzaItem = {
    id: pizza.id,
    name: pizza.name,
    description: pizza.description,
    imageUrl: pizza.imageUrl,
    prices,
    availableSizes: sizes,
    categoryId: pizza.categoryId,
  };

  const allPizzaItems: PizzaItem[] = allPizzas.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    imageUrl: p.imageUrl,
    prices: p.prices as Record<string, number>,
    availableSizes: p.availableSizes as string[],
    categoryId: p.categoryId,
  }));

  return (
    <>
      <div className="pizza-card bg-card rounded-2xl overflow-hidden border border-border group flex flex-col transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
        {/* Image */}
        <div className="relative h-44 overflow-hidden flex-shrink-0">
          {pizza.imageUrl ? (
            <img
              src={pizza.imageUrl}
              alt={pizza.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <span className="text-5xl">{getProductEmoji(pizza.name)}</span>
            </div>
          )}
          {pizza.featured && (
            <div className="absolute top-3 left-3 bg-primary text-primary-foreground text-xs font-semibold px-2.5 py-1 rounded-full shadow">
              ⭐ Destaque
            </div>
          )}
          {isPizza && (
            <div className="absolute top-3 right-3 bg-background/80 backdrop-blur-sm text-[10px] font-semibold text-muted-foreground px-2 py-0.5 rounded-full border border-border">
              Meio a meio
            </div>
          )}
          <div className="absolute bottom-3 right-3 bg-background/90 backdrop-blur-sm rounded-full px-3 py-1">
            <span className="text-primary font-bold text-sm">
              {isMultiSize ? `A partir de R$ ${Math.min(...Object.values(prices)).toFixed(2)}` : `R$ ${firstPrice.toFixed(2)}`}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col flex-1">
          <h3 className="font-serif text-base font-semibold text-foreground mb-1 leading-tight">{pizza.name}</h3>
          {pizza.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed flex-1">
              {pizza.description}
            </p>
          )}

          {/* Size preview chips */}
          {isMultiSize && (
            <div className="flex flex-wrap gap-1 mb-3">
              {sizes.slice(0, 4).map((size) => {
                const config = SIZE_CONFIG[size];
                return (
                  <span key={size} className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                    {config?.label ?? size}: R${(prices[size] ?? 0).toFixed(0)}
                  </span>
                );
              })}
              {sizes.length > 4 && (
                <span className="text-[10px] text-muted-foreground px-1">+{sizes.length - 4}</span>
              )}
            </div>
          )}

          {/* CTA Button */}
          {isPizza || isMultiSize ? (
            <Button
              onClick={handleOpenModal}
              size="sm"
              className="w-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground border border-primary/30 font-semibold transition-all mt-auto gap-1.5"
            >
              <Settings2 className="w-3.5 h-3.5" />
              {isPizza ? "Personalizar" : "Escolher tamanho"}
            </Button>
          ) : (
            <Button
              onClick={handleDirectAdd}
              size="sm"
              className="w-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground border border-primary/30 font-semibold transition-all mt-auto gap-1.5"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Adicionar — R$ {firstPrice.toFixed(2)}
            </Button>
          )}
        </div>
      </div>

      {/* Modal de personalização */}
      {(isPizza || isMultiSize) && (
        <PizzaOrderModal
          pizza={pizzaItem}
          allPizzas={allPizzaItems}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
