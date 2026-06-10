import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Star, Loader2, Link2 } from "lucide-react";

// Tamanhos disponíveis para pizzas
const PIZZA_SIZES = [
  { key: "brotinho", label: "Brotinho (1 fatia)" },
  { key: "pequena",  label: "Pequena (6 fatias)" },
  { key: "media",    label: "Média (8 fatias)" },
  { key: "grande",   label: "Grande (10 fatias)" },
  { key: "trem",     label: "Trem (18 fatias)" },
  { key: "bitrem",   label: "Bi-Trem (36 fatias)" },
];

type SizePrice = { size: string; price: string };

interface FormState {
  name: string;
  description: string;
  imageUrl: string;
  categoryId: string;
  erpCode: string;
  featured: boolean;
  active: boolean;
  sortOrder: string;
  priceMode: "unico" | "sizes";
  priceUnico: string;
  sizePrices: SizePrice[];
}

const emptyForm = (): FormState => ({
  name: "",
  description: "",
  imageUrl: "",
  categoryId: "",
  erpCode: "",
  featured: false,
  active: true,
  sortOrder: "0",
  priceMode: "unico",
  priceUnico: "",
  sizePrices: PIZZA_SIZES.map((s) => ({ size: s.key, price: "" })),
});

function buildPricesPayload(form: FormState): { prices: Record<string, number>; availableSizes: string[] } {
  if (form.priceMode === "unico") {
    const p = parseFloat(form.priceUnico);
    return { prices: { unico: isNaN(p) ? 0 : p }, availableSizes: ["unico"] };
  }
  const filled = form.sizePrices.filter((sp) => sp.price !== "" && !isNaN(parseFloat(sp.price)));
  const prices: Record<string, number> = {};
  const sizes: string[] = [];
  for (const sp of filled) {
    prices[sp.size] = parseFloat(sp.price);
    sizes.push(sp.size);
  }
  return { prices, availableSizes: sizes };
}

function formFromItem(item: {
  name: string;
  description: string | null;
  imageUrl: string | null;
  categoryId: number;
  erpCode?: string | null;
  featured: boolean;
  active: boolean;
  sortOrder: number;
  prices: unknown;
  availableSizes: unknown;
}): FormState {
  const prices = item.prices as Record<string, number>;
  const sizes = item.availableSizes as string[];
  const isUnico = sizes.length === 1 && sizes[0] === "unico";
  return {
    name: item.name,
    description: item.description ?? "",
    imageUrl: item.imageUrl ?? "",
    categoryId: String(item.categoryId),
    erpCode: item.erpCode ?? "",
    featured: item.featured,
    active: item.active,
    sortOrder: String(item.sortOrder),
    priceMode: isUnico ? "unico" : "sizes",
    priceUnico: isUnico ? String(prices["unico"] ?? "") : "",
    sizePrices: PIZZA_SIZES.map((s) => ({
      size: s.key,
      price: prices[s.key] !== undefined ? String(prices[s.key]) : "",
    })),
  };
}

export default function AdminMenu() {
  const utils = trpc.useUtils();
  const { data: categories } = trpc.categories.list.useQuery({ onlyActive: false });
  const { data: pizzas, isLoading } = trpc.pizzas.list.useQuery({ onlyActive: false });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [filterCat, setFilterCat] = useState<string>("all");

  const createItem = trpc.pizzas.create.useMutation({
    onSuccess: () => {
      toast.success("Item criado com sucesso!");
      utils.pizzas.list.invalidate();
      utils.pizzas.featured.invalidate();
      setDialogOpen(false);
    },
    onError: (e) => toast.error("Erro ao criar item", { description: e.message }),
  });

  const updateItem = trpc.pizzas.update.useMutation({
    onSuccess: () => {
      toast.success("Item atualizado!");
      utils.pizzas.list.invalidate();
      utils.pizzas.featured.invalidate();
      setDialogOpen(false);
    },
    onError: (e) => toast.error("Erro ao atualizar item", { description: e.message }),
  });

  const deleteItem = trpc.pizzas.delete.useMutation({
    onSuccess: () => {
      toast.success("Item removido!");
      utils.pizzas.list.invalidate();
      utils.pizzas.featured.invalidate();
    },
    onError: (e) => toast.error("Erro ao remover item", { description: e.message }),
  });

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function openEdit(item: NonNullable<typeof pizzas>[number]) {
    setEditingId(item.id);
    setForm(formFromItem(item));
    setDialogOpen(true);
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setSizePrice(sizeKey: string, price: string) {
    setForm((f) => ({
      ...f,
      sizePrices: f.sizePrices.map((sp) => (sp.size === sizeKey ? { ...sp, price } : sp)),
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    if (!form.categoryId) { toast.error("Selecione uma categoria"); return; }

    const { prices, availableSizes } = buildPricesPayload(form);
    if (availableSizes.length === 0) { toast.error("Informe pelo menos um preço"); return; }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      imageUrl: form.imageUrl.trim() || undefined,
      categoryId: parseInt(form.categoryId),
      erpCode: form.erpCode.trim() || undefined,
      featured: form.featured,
      active: form.active,
      sortOrder: parseInt(form.sortOrder) || 0,
      prices,
      availableSizes,
    };

    if (editingId) {
      updateItem.mutate({ id: editingId, ...payload });
    } else {
      createItem.mutate(payload);
    }
  }

  const filtered = filterCat === "all"
    ? pizzas
    : pizzas?.filter((p) => String(p.categoryId) === filterCat);

  const isPending = createItem.isPending || updateItem.isPending;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Cardápio</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie os itens do cardápio</p>
        </div>
        <Button onClick={openCreate} className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
          <Plus className="w-4 h-4" />
          Novo Item
        </Button>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setFilterCat("all")}
          className={`px-4 py-1.5 rounded-full text-sm border transition-all ${filterCat === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
        >
          Todos
        </button>
        {categories?.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setFilterCat(String(cat.id))}
            className={`px-4 py-1.5 rounded-full text-sm border transition-all ${filterCat === String(cat.id) ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Items list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 bg-card rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered?.map((item) => {
            const prices = item.prices as Record<string, number>;
            const sizes = item.availableSizes as string[];
            const isUnico = sizes.length === 1 && sizes[0] === "unico";
            const minPrice = Math.min(...Object.values(prices));
            const maxPrice = Math.max(...Object.values(prices));
            const cat = categories?.find((c) => c.id === item.categoryId);
            return (
              <div
                key={item.id}
                className={`bg-card border rounded-xl p-4 flex items-center gap-4 transition-all ${
                  item.active ? "border-border" : "border-border/30 opacity-50"
                }`}
              >
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 text-2xl">🍕</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground text-sm">{item.name}</span>
                    {item.featured && <Star className="w-3.5 h-3.5 text-primary fill-primary" />}
                    {!item.active && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
                    {cat && <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{cat.name}</span>}
                  </div>
                  {item.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{item.description}</p>
                  )}
                  {(item as any).erpCode && (
                    <p className="text-[10px] text-amber-500/70 font-mono mt-0.5">ERP: {(item as any).erpCode}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-primary font-semibold text-sm">
                    {isUnico
                      ? `R$ ${minPrice.toFixed(2)}`
                      : `R$ ${minPrice.toFixed(2)} – ${maxPrice.toFixed(2)}`}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{sizes.length} tamanho{sizes.length > 1 ? "s" : ""}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(item)} className="h-8 w-8">
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm(`Remover "${item.name}"?`)) deleteItem.mutate({ id: item.id });
                    }}
                    className="h-8 w-8 hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-foreground">
              {editingId ? "Editar Item" : "Novo Item do Cardápio"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5 pt-2">
            {/* Basic info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label className="text-sm font-medium text-foreground mb-1.5 block">Nome *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="Ex: Calabresa, Margherita..."
                  className="bg-input border-border"
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-sm font-medium text-foreground mb-1.5 block">Descrição</Label>
                <textarea
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                  placeholder="Ingredientes, detalhes..."
                  rows={2}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-sm font-medium text-foreground mb-1.5 block">URL da Imagem</Label>
                <Input
                  value={form.imageUrl}
                  onChange={(e) => setField("imageUrl", e.target.value)}
                  placeholder="https://..."
                  className="bg-input border-border"
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-sm font-medium text-foreground mb-1.5 block flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-amber-500" />
                  Código ERP
                  <span className="text-muted-foreground font-normal text-xs">(para integração com Delphi)</span>
                </Label>
                <Input
                  value={form.erpCode}
                  onChange={(e) => setField("erpCode", e.target.value)}
                  placeholder="Ex: PROD-001, 12345..."
                  className="bg-input border-border font-mono"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-foreground mb-1.5 block">Categoria *</Label>
                <Select value={form.categoryId} onValueChange={(v) => setField("categoryId", v)}>
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-foreground mb-1.5 block">Ordem de exibição</Label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setField("sortOrder", e.target.value)}
                  className="bg-input border-border"
                />
              </div>
            </div>

            <Separator />

            {/* Price mode */}
            <div>
              <Label className="text-sm font-medium text-foreground mb-3 block">Tipo de Preço *</Label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setField("priceMode", "unico")}
                  className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${form.priceMode === "unico" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
                >
                  Preço único
                </button>
                <button
                  type="button"
                  onClick={() => setField("priceMode", "sizes")}
                  className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${form.priceMode === "sizes" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
                >
                  Por tamanho (pizza)
                </button>
              </div>
            </div>

            {form.priceMode === "unico" ? (
              <div>
                <Label className="text-sm font-medium text-foreground mb-1.5 block">Preço (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.priceUnico}
                  onChange={(e) => setField("priceUnico", e.target.value)}
                  placeholder="0,00"
                  className="bg-input border-border max-w-xs"
                />
              </div>
            ) : (
              <div>
                <Label className="text-sm font-medium text-foreground mb-3 block">
                  Preços por tamanho <span className="text-muted-foreground font-normal">(deixe vazio para não oferecer)</span>
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {PIZZA_SIZES.map((s) => {
                    const sp = form.sizePrices.find((x) => x.size === s.key);
                    return (
                      <div key={s.key} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-28 flex-shrink-0">{s.label}</span>
                        <div className="flex items-center gap-1 flex-1">
                          <span className="text-xs text-muted-foreground">R$</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={sp?.price ?? ""}
                            onChange={(e) => setSizePrice(s.key, e.target.value)}
                            placeholder="—"
                            className="bg-input border-border h-8 text-sm"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <Separator />

            {/* Toggles */}
            <div className="flex gap-6">
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.featured}
                  onCheckedChange={(v) => setField("featured", v)}
                  id="featured"
                />
                <Label htmlFor="featured" className="text-sm text-foreground cursor-pointer">
                  Destaque na home
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.active}
                  onCheckedChange={(v) => setField("active", v)}
                  id="active"
                />
                <Label htmlFor="active" className="text-sm text-foreground cursor-pointer">
                  Ativo no cardápio
                </Label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="flex-1 border-border"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
                ) : (
                  editingId ? "Salvar Alterações" : "Criar Item"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
