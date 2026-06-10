import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, Trash2, Plus, Minus, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";



export default function CartDrawer() {
  const { items, isOpen, closeCart, removeItem, updateQuantity, subtotal, totalItems } = useCart();
  const [, navigate] = useLocation();

  const handleCheckout = () => {
    closeCart();
    navigate("/checkout");
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeCart()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col bg-card border-border p-0"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <SheetTitle className="font-serif text-xl text-foreground flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            Seu Pedido
            {totalItems > 0 && (
              <span className="ml-auto text-sm font-normal bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                {totalItems} {totalItems === 1 ? "item" : "itens"}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground px-6">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
              <ShoppingCart className="w-9 h-9 opacity-40" />
            </div>
            <p className="text-center text-sm">
              Seu carrinho está vazio.<br />
              Adicione pizzas para começar!
            </p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {items.map((item) => (
                <div key={item.id} className="flex gap-3 group">
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.pizzaName}
                      className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground leading-tight">{item.pizzaName}</p>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {item.sizeLabel && item.sizeLabel !== "Único" && (
                        <span className="text-xs text-muted-foreground">{item.sizeLabel}</span>
                      )}
                      {item.crustLabel && (
                        <span className="text-xs text-amber-500/80">• Borda {item.crustLabel}</span>
                      )}
                    </div>
                    <p className="text-xs text-primary font-semibold mt-0.5">
                      R$ {item.unitPrice.toFixed(2)} / un.
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:border-primary hover:text-primary transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-sm font-medium w-5 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:border-primary hover:text-primary transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col items-end justify-between">
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <p className="text-sm font-semibold text-foreground">
                      R$ {item.totalPrice.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-6 pb-6 pt-4 border-t border-border space-y-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span>R$ {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Taxa de entrega</span>
                <span>R$ 5,00</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between font-semibold text-foreground">
                <span>Total</span>
                <span className="text-primary text-lg">R$ {(subtotal + 5).toFixed(2)}</span>
              </div>
              <Button
                onClick={handleCheckout}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold h-12 text-base"
              >
                Finalizar Pedido
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
