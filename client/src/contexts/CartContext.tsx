import React, { createContext, useContext, useState, useCallback } from "react";

export interface CartItem {
  id: string; // unique key: pizzaId + (secondFlavorId?) + size + (crust?)
  pizzaId: number;
  pizzaName: string;
  imageUrl?: string;
  // Meio a meio
  secondFlavorId?: number;
  secondFlavorName?: string;
  extraFlavorIds?: number[];
  extraFlavorNames?: string[];
  size: string;
  sizeLabel: string;
  // Borda recheada
  crust?: string;       // ex: "mussarela", "cheddar", "catupiry", "4queijos", "chocolate"
  crustLabel?: string;  // ex: "Mussarela"
  crustPrice?: number;  // preço adicional da borda
  selectedOptions?: {
    groupId: string;
    groupName: string;
    choiceId: string;
    choiceName: string;
    priceDelta?: number;
  }[];
  selectedAddons?: {
    addonId: number;
    addonName: string;
    addonPrice: number;
  }[];
  quantity: number;
  unitPrice: number;    // preço base (pizza + borda)
  totalPrice: number;   // unitPrice * quantity
}

interface CartContextValue {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  addItem: (item: Omit<CartItem, "id" | "totalPrice">) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function makeItemId(item: Omit<CartItem, "id" | "totalPrice">): string {
  const parts = [item.pizzaId, item.size];
  if (item.extraFlavorIds?.length) parts.push(item.extraFlavorIds.join("."));
  else if (item.secondFlavorId) parts.push(item.secondFlavorId);
  if (item.crust) parts.push(item.crust);
  if (item.selectedOptions?.length) {
    parts.push(item.selectedOptions.map((option) => `${option.groupId}:${option.choiceId}`).join("."));
  }
  if (item.selectedAddons?.length) {
    parts.push(item.selectedAddons.map((addon) => `addon:${addon.addonId}`).sort().join("."));
  }
  return parts.join("-");
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const addItem = useCallback((item: Omit<CartItem, "id" | "totalPrice">) => {
    const id = makeItemId(item);
    setItems((prev) => {
      const existing = prev.find((i) => i.id === id);
      if (existing) {
        const newQty = existing.quantity + item.quantity;
        return prev.map((i) =>
          i.id === id ? { ...i, quantity: newQty, totalPrice: newQty * i.unitPrice } : i
        );
      }
      return [...prev, { ...item, id, totalPrice: item.quantity * item.unitPrice }];
    });
    setIsOpen(true);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      return;
    }
    setItems((prev) =>
      prev.map((i) => i.id === id ? { ...i, quantity, totalPrice: quantity * i.unitPrice } : i)
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);
  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.totalPrice, 0);

  return (
    <CartContext.Provider
      value={{ items, totalItems, subtotal, addItem, removeItem, updateQuantity, clearCart, isOpen, openCart, closeCart }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
