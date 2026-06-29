import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";
import { ShoppingCart, ChevronDown, ChevronUp, Pizza, Check } from "lucide-react";

type FlavorConfig = {
  enabled: boolean;
  maxFlavors: number;
  maxFlavorsBySize?: Record<string, number>;
  allowedCategoryIds?: number[];
  priceMode?: "average" | "base";
};
type CrustConfig = {
  enabled: boolean;
  allowedCategoryIds?: number[];
};
type ProductOptionChoice = {
  id: string;
  name: string;
  priceDelta?: number;
};
type ProductOptionGroup = {
  id: string;
  name: string;
  required: boolean;
  selectionMode?: "single" | "multiple";
  sourceCategoryIds?: number[];
  choices: ProductOptionChoice[];
};
type ProductAddon = {
  id: number;
  name: string;
  description?: string | null;
  price: string;
  active: boolean;
};

export type PizzaItem = {
  id: number;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  prices: Record<string, number>;
  availableSizes: string[];
  categoryId: number;
  flavorConfig?: FlavorConfig;
  crustConfig?: CrustConfig;
  productOptions?: ProductOptionGroup[];
  addons?: ProductAddon[];
};

export const SIZE_CONFIG: Record<string, { label: string; slices: string }> = {
  brotinho: { label: "Brotinho", slices: "1 fatia" },
  pequena: { label: "Pequena", slices: "6 fatias" },
  media: { label: "Media", slices: "8 fatias" },
  grande: { label: "Grande", slices: "10 fatias" },
  trem: { label: "Trem", slices: "18 fatias" },
  bitrem: { label: "Bi-Trem", slices: "36 fatias" },
  unico: { label: "Unico", slices: "" },
  copo: { label: "Copo", slices: "" },
  jarra: { label: "Jarra", slices: "" },
};

interface PizzaOrderModalProps {
  pizza: PizzaItem | null;
  allPizzas: PizzaItem[];
  open: boolean;
  onClose: () => void;
}

export default function PizzaOrderModal({ pizza, allPizzas, open, onClose }: PizzaOrderModalProps) {
  const { addItem } = useCart();

  const [selectedSize, setSelectedSize] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [isHalfHalf, setIsHalfHalf] = useState(false);
  const [extraFlavors, setExtraFlavors] = useState<PizzaItem[]>([]);
  const [showSecondFlavors, setShowSecondFlavors] = useState(false);
  const [selectedCrust, setSelectedCrust] = useState("");
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});
  const [selectedAddonIds, setSelectedAddonIds] = useState<number[]>([]);

  useEffect(() => {
    if (!open || !pizza || selectedSize) return;
    if (pizza.availableSizes.length === 1) {
      setSelectedSize(pizza.availableSizes[0]);
    }
  }, [open, pizza, selectedSize]);

  const flavorConfig = pizza?.flavorConfig;
  const flavorOptions = useMemo(() => {
    if (!pizza) return [];
    const allowedCategoryIds = flavorConfig?.allowedCategoryIds ?? [];
    return allPizzas.filter((item) => {
      if (item.id === pizza.id) return false;
      if (allowedCategoryIds.length === 0) return item.categoryId === pizza.categoryId;
      return allowedCategoryIds.includes(item.categoryId);
    });
  }, [pizza, allPizzas, flavorConfig?.allowedCategoryIds]);

  const crustConfig = pizza?.crustConfig;
  const crustOptions = useMemo(() => {
    if (!pizza || !selectedSize || !crustConfig?.enabled) return [];
    const allowedCategoryIds = crustConfig.allowedCategoryIds ?? [];
    if (allowedCategoryIds.length === 0) return [];
    return allPizzas
      .filter((item) => item.id !== pizza.id && allowedCategoryIds.includes(item.categoryId))
      .map((item) => ({
        key: String(item.id),
        label: item.name,
        price: item.prices[selectedSize] ?? item.prices.unico ?? Object.values(item.prices)[0] ?? 0,
      }))
      .filter((item) => item.price >= 0);
  }, [pizza, allPizzas, selectedSize, crustConfig]);

  const maxFlavorsForSize = selectedSize
    ? Math.max(1, flavorConfig?.maxFlavorsBySize?.[selectedSize] ?? flavorConfig?.maxFlavors ?? 1)
    : Math.max(1, flavorConfig?.maxFlavors ?? 1);
  const maxExtraFlavors = Math.max(0, maxFlavorsForSize - 1);
  const canSelectFlavors = Boolean(flavorConfig?.enabled && selectedSize && maxFlavorsForSize > 1 && flavorOptions.length > 0);
  const selectedFlavorCount = 1 + extraFlavors.length;
  const isMultiFlavor = isHalfHalf && extraFlavors.length > 0;
  const crustOption = crustOptions.find((item) => item.key === selectedCrust);
  const hasCrust = selectedSize && crustOptions.length > 0;
  const crustPrice = crustOption?.price ?? 0;
  const productOptions = pizza?.productOptions ?? [];
  const optionGroups = useMemo(() => {
    if (!pizza) return [];
    return productOptions
      .map((group) => {
        const sourceCategoryIds = group.sourceCategoryIds ?? [];
        const categoryChoices = allPizzas
          .filter((item) => item.id !== pizza.id && sourceCategoryIds.includes(item.categoryId))
          .map((item) => ({
            id: `product-${item.id}`,
            name: item.name,
            priceDelta: selectedSize
              ? item.prices[selectedSize] ?? item.prices.unico ?? Object.values(item.prices)[0] ?? 0
              : item.prices.unico ?? Object.values(item.prices)[0] ?? 0,
          }));

        return {
          ...group,
          choices: [...group.choices, ...categoryChoices],
        };
      })
      .filter((group) => group.choices.length > 0);
  }, [pizza, productOptions, allPizzas, selectedSize]);

  useEffect(() => {
    setSelectedOptions((current) => {
      const validGroupIds = new Set(optionGroups.map((group) => group.id));
      let changed = false;
      const next: Record<string, string[]> = {};

      for (const group of optionGroups) {
        const validChoiceIds = new Set(group.choices.map((choice) => choice.id));
        const validSelected = (current[group.id] ?? []).filter((choiceId) => validChoiceIds.has(choiceId));
        if (validSelected.length > 0) next[group.id] = validSelected;
        if (validSelected.length !== (current[group.id] ?? []).length) changed = true;
      }

      if (Object.keys(current).some((groupId) => !validGroupIds.has(groupId))) changed = true;
      return changed ? next : current;
    });
  }, [optionGroups]);

  const selectedOptionDetails = optionGroups.flatMap((group) => {
    const selectedChoiceIds = selectedOptions[group.id] ?? [];
    return group.choices.filter((item) => selectedChoiceIds.includes(item.id)).map((choice) => ({
      groupId: group.id,
      groupName: group.name,
      choiceId: choice.id,
      choiceName: choice.name,
      priceDelta: choice.priceDelta ?? 0,
    }));
  });
  const addonOptions = (pizza?.addons ?? []).filter((addon) => addon.active);
  const selectedAddonDetails = addonOptions
    .filter((addon) => selectedAddonIds.includes(addon.id))
    .map((addon) => ({
      addonId: addon.id,
      addonName: addon.name,
      addonPrice: Number(addon.price ?? 0),
    }));
  const addonsPrice = selectedAddonDetails.reduce((sum, addon) => sum + addon.addonPrice, 0);

  const basePrice = useMemo(() => {
    if (!pizza || !selectedSize) return 0;
    if (isHalfHalf && flavorConfig?.priceMode === "base") {
      return pizza.prices[selectedSize] ?? 0;
    }
    if (isHalfHalf && extraFlavors.length > 0) {
      const selectedFlavors = [pizza, ...extraFlavors];
      const total = selectedFlavors.reduce((sum, flavor) => sum + (flavor.prices[selectedSize] ?? 0), 0);
      return total / selectedFlavors.length;
    }
    return pizza.prices[selectedSize] ?? 0;
  }, [pizza, selectedSize, isHalfHalf, extraFlavors, flavorConfig?.priceMode]);

  const principalOptionGroups = optionGroups.filter((group) =>
    group.choices.some((choice) => (choice.priceDelta ?? 0) > 0)
  );
  const selectedPrincipalOptions = selectedOptionDetails.filter((option) =>
    principalOptionGroups.some((group) => group.id === option.groupId) && (option.priceDelta ?? 0) > 0
  );
  const selectedPricedOption = selectedPrincipalOptions[0];
  const productPrice = selectedPricedOption?.priceDelta ?? basePrice;
  const extraOptionsPrice = selectedOptionDetails
    .filter((option) => !principalOptionGroups.some((group) => group.id === option.groupId))
    .reduce((sum, option) => sum + (option.priceDelta ?? 0), 0);
  const unitPrice = productPrice + extraOptionsPrice + addonsPrice + (selectedCrust ? crustPrice : 0);
  const totalPrice = unitPrice * quantity;

  function handleClose() {
    setSelectedSize("");
    setQuantity(1);
    setIsHalfHalf(false);
    setExtraFlavors([]);
    setShowSecondFlavors(false);
    setSelectedCrust("");
    setSelectedOptions({});
    setSelectedAddonIds([]);
    onClose();
  }

  function selectSize(size: string) {
    setSelectedSize(size);
    const nextLimit = Math.max(1, flavorConfig?.maxFlavorsBySize?.[size] ?? flavorConfig?.maxFlavors ?? 1);
    setExtraFlavors((current) => current.slice(0, Math.max(0, nextLimit - 1)));
    if (nextLimit <= 1) {
      setIsHalfHalf(false);
      setShowSecondFlavors(false);
    }
    setSelectedCrust("");
  }

  function toggleExtraFlavor(flavor: PizzaItem) {
    setExtraFlavors((current) => {
      if (current.some((item) => item.id === flavor.id)) {
        return current.filter((item) => item.id !== flavor.id);
      }
      if (current.length >= maxExtraFlavors) {
        toast.error(`Este tamanho permite no maximo ${maxFlavorsForSize} sabores.`);
        return current;
      }
      return [...current, flavor];
    });
  }

  function handleAddToCart() {
    if (!pizza || !selectedSize) {
      toast.error("Selecione o tamanho do item.");
      return;
    }
    if (isHalfHalf && extraFlavors.length === 0) {
      toast.error("Selecione pelo menos mais um sabor.");
      return;
    }
    const missingOption = optionGroups.find((group) => group.required && (selectedOptions[group.id]?.length ?? 0) === 0);
    if (missingOption) {
      toast.error(`Selecione: ${missingOption.name}`);
      return;
    }

    const sizeConfig = SIZE_CONFIG[selectedSize];
    const flavorNames = [pizza.name, ...extraFlavors.map((flavor) => flavor.name)];
    const flavorName = isMultiFlavor ? flavorNames.join(" / ") : pizza.name;

    addItem({
      pizzaId: pizza.id,
      pizzaName: flavorName,
      imageUrl: pizza.imageUrl ?? undefined,
      secondFlavorId: isMultiFlavor ? extraFlavors[0].id : undefined,
      secondFlavorName: isMultiFlavor ? extraFlavors[0].name : undefined,
      extraFlavorIds: isMultiFlavor ? extraFlavors.map((flavor) => flavor.id) : undefined,
      extraFlavorNames: isMultiFlavor ? extraFlavors.map((flavor) => flavor.name) : undefined,
      size: selectedSize,
      sizeLabel: sizeConfig?.label ?? selectedSize,
      crust: selectedCrust || undefined,
      crustLabel: crustOption?.label,
      crustPrice: selectedCrust ? crustPrice : undefined,
      selectedOptions: selectedOptionDetails,
      selectedAddons: selectedAddonDetails,
      quantity,
      unitPrice,
    });

    toast.success(`${flavorName} adicionado ao carrinho!`);
    handleClose();
  }

  function toggleAddon(addonId: number) {
    setSelectedAddonIds((current) =>
      current.includes(addonId) ? current.filter((id) => id !== addonId) : [...current, addonId]
    );
  }

  function toggleProductOption(group: ProductOptionGroup, choiceId: string) {
    setSelectedOptions((current) => {
      const selected = current[group.id] ?? [];
      if (selected.includes(choiceId)) return { ...current, [group.id]: [] };
      return { ...current, [group.id]: [choiceId] };
    });
  }

  if (!pizza) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl text-foreground">{pizza.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {pizza.imageUrl && (
            <img src={pizza.imageUrl} alt={pizza.name} className="w-full h-44 object-cover rounded-xl" />
          )}

          {pizza.description && <p className="text-sm text-muted-foreground">{pizza.description}</p>}

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
                    onClick={() => selectSize(size)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 bg-card"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-sm font-semibold ${isSelected ? "text-primary" : "text-foreground"}`}>
                          {config?.label ?? size}
                        </p>
                        {config?.slices && <p className="text-xs text-muted-foreground">{config.slices}</p>}
                      </div>
                      <p className={`text-sm font-bold ${isSelected ? "text-primary" : "text-foreground"}`}>
                        R$ {price.toFixed(2)}
                      </p>
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

          {canSelectFlavors && (
            <div>
              <Separator className="bg-border mb-4" />
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {maxFlavorsForSize === 2 ? "Meio a Meio?" : "Selecionar sabores?"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Escolha ate {maxFlavorsForSize} sabores diferentes
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsHalfHalf(!isHalfHalf);
                    if (isHalfHalf) {
                      setExtraFlavors([]);
                      setShowSecondFlavors(false);
                    }
                  }}
                  className={`relative w-11 h-6 rounded-full transition-colors ${isHalfHalf ? "bg-primary" : "bg-muted"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isHalfHalf ? "translate-x-5" : ""}`} />
                </button>
              </div>

              {isHalfHalf && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/40 bg-primary/5">
                    <Pizza className="w-4 h-4 text-primary flex-shrink-0" />
                    <p className="flex-1 text-sm font-medium text-foreground">1o sabor: {pizza.name}</p>
                    <Badge className="bg-primary/20 text-primary border-0 text-xs">Selecionado</Badge>
                  </div>

                  <button
                    onClick={() => setShowSecondFlavors(!showSecondFlavors)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      extraFlavors.length > 0
                        ? "border-primary/40 bg-primary/5"
                        : "border-dashed border-border hover:border-primary/50"
                    }`}
                  >
                    <Pizza className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 text-left">
                      {extraFlavors.length > 0 ? (
                        <div className="space-y-0.5">
                          {extraFlavors.map((flavor, index) => (
                            <p key={flavor.id} className="text-sm font-medium text-foreground">
                              {index + 2}o sabor: {flavor.name}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {maxFlavorsForSize === 2 ? "Escolher 2o sabor..." : "Escolher sabores adicionais..."}
                        </p>
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
                      {flavorOptions.map((option) => {
                        const selected = extraFlavors.some((flavor) => flavor.id === option.id);
                        return (
                          <button
                            key={option.id}
                            onClick={() => {
                              toggleExtraFlavor(option);
                              if (maxExtraFlavors <= 1) setShowSecondFlavors(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-primary/5 transition-colors ${
                              selected ? "bg-primary/10" : ""
                            }`}
                          >
                            <span className="flex-1 text-sm text-foreground">{option.name}</span>
                            {selected && <Check className="w-4 h-4 text-primary" />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {extraFlavors.length > 0 && (
                    <p className="text-xs text-muted-foreground text-center">
                      {flavorConfig?.priceMode === "base"
                        ? "Preco permanece o valor do item escolhido"
                        : `Preco = media dos ${selectedFlavorCount} sabores no tamanho escolhido`}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {optionGroups.length > 0 && (
            <div>
              <Separator className="bg-border mb-4" />
              <div className="space-y-4">
                {optionGroups.map((group) => (
                  <div key={group.id}>
                    <h3 className="text-sm font-semibold text-foreground mb-2">
                      {group.name}
                      {group.required && <span className="text-primary"> *</span>}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-2">Selecione uma opcao.</p>
                    <div className="grid grid-cols-1 gap-2">
                      {group.choices.map((choice) => {
                        const selected = (selectedOptions[group.id] ?? []).includes(choice.id);
                        const optionPrice = choice.priceDelta ?? 0;
                        return (
                          <button
                            key={choice.id}
                            onClick={() => toggleProductOption(group, choice.id)}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              selected ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 bg-card"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className={`text-sm font-medium ${selected ? "text-primary" : "text-foreground"}`}>
                                {choice.name}
                              </span>
                              <div className="flex items-center gap-2">
                                {optionPrice > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    R$ {optionPrice.toFixed(2)}
                                  </span>
                                )}
                                {selected && <Check className="w-4 h-4 text-primary" />}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {addonOptions.length > 0 && (
            <div>
              <Separator className="bg-border mb-4" />
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">Adicionais</h3>
                <p className="text-xs text-muted-foreground mb-3">Selecione quantos quiser.</p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {addonOptions.map((addon) => {
                  const selected = selectedAddonIds.includes(addon.id);
                  const price = Number(addon.price ?? 0);
                  return (
                    <button
                      key={addon.id}
                      onClick={() => toggleAddon(addon.id)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        selected ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 bg-card"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <span className={`text-sm font-medium ${selected ? "text-primary" : "text-foreground"}`}>
                            {addon.name}
                          </span>
                          {addon.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{addon.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">+ R$ {price.toFixed(2)}</span>
                          {selected && <Check className="w-4 h-4 text-primary" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {hasCrust && (
            <div>
              <Separator className="bg-border mb-4" />
              <h3 className="text-sm font-semibold text-foreground mb-1">
                Borda Recheada{" "}
              </h3>
              <p className="text-xs text-muted-foreground mb-3">Opcional - escolha o sabor da borda</p>
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
                {crustOptions.map((option) => (
                  <button
                    key={option.key}
                    onClick={() => setSelectedCrust(option.key)}
                    className={`px-4 py-2 rounded-full text-sm border transition-all ${
                      selectedCrust === option.key
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {option.label} (+R$ {option.price.toFixed(2)})
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <Separator className="bg-border mb-4" />
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Quantidade</h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-foreground hover:border-primary hover:text-primary transition-colors text-lg font-bold"
                >
                  -
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

          {selectedSize && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-1.5">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{selectedPricedOption ? "Preco principal" : `Item (${SIZE_CONFIG[selectedSize]?.label ?? selectedSize})`}</span>
                <span>R$ {productPrice.toFixed(2)}</span>
              </div>
              {selectedCrust && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Borda {crustOption?.label}</span>
                  <span>+ R$ {crustPrice.toFixed(2)}</span>
                </div>
              )}
              {selectedOptionDetails.map((option) => (
                <div key={option.groupId} className="flex justify-between text-sm text-muted-foreground">
                  <span>{option.groupName}: {option.choiceName}</span>
                  <span>
                    {(option.priceDelta ?? 0) > 0 && option.choiceId !== selectedPricedOption?.choiceId
                      ? `R$ ${(option.priceDelta ?? 0).toFixed(2)}`
                      : "preco principal"}
                  </span>
                </div>
              ))}
              {selectedAddonDetails.map((addon) => (
                <div key={addon.addonId} className="flex justify-between text-sm text-muted-foreground">
                  <span>+ {addon.addonName}</span>
                  <span>+ R$ {addon.addonPrice.toFixed(2)}</span>
                </div>
              ))}
              {quantity > 1 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>x {quantity}</span>
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

          <Button
            onClick={handleAddToCart}
            disabled={!selectedSize}
            className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-base gap-2"
          >
            <ShoppingCart className="w-5 h-5" />
            Adicionar ao Carrinho
            {selectedSize && ` - R$ ${totalPrice.toFixed(2)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
