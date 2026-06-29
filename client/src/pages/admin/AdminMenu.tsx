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
const PRODUCT_SIZES = [
  ...PIZZA_SIZES,
  { key: "copo", label: "Copo" },
  { key: "jarra", label: "Jarra" },
];

type SizePrice = { size: string; price: string };
type FlavorPriceMode = "average" | "base";
type FlavorConfig = {
  enabled: boolean;
  maxFlavors: number;
  maxFlavorsBySize: Record<string, number>;
  allowedCategoryIds: number[];
  priceMode: FlavorPriceMode;
};
type CrustConfig = {
  enabled: boolean;
  allowedCategoryIds: number[];
};
type ProductOptionChoice = {
  id: string;
  name: string;
  priceDelta: string;
};
type ProductOptionGroup = {
  id: string;
  name: string;
  required: boolean;
  selectionMode: "single" | "multiple";
  sourceCategoryIds: string[];
  choices: ProductOptionChoice[];
};
type CategoryFormState = {
  name: string;
  slug: string;
  description: string;
  sortOrder: string;
  active: boolean;
};

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
  flavorEnabled: boolean;
  flavorMax: string;
  flavorMaxBySize: Record<string, string>;
  flavorAllowedCategoryIds: string[];
  flavorPriceMode: FlavorPriceMode;
  crustEnabled: boolean;
  crustAllowedCategoryIds: string[];
  addonIds: string[];
  productOptions: ProductOptionGroup[];
}

const DEFAULT_FLAVOR_CONFIG: FlavorConfig = {
  enabled: false,
  maxFlavors: 1,
  maxFlavorsBySize: {},
  allowedCategoryIds: [],
  priceMode: "average",
};

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
  sizePrices: PRODUCT_SIZES.map((s) => ({ size: s.key, price: "" })),
  flavorEnabled: false,
  flavorMax: "1",
  flavorMaxBySize: Object.fromEntries(PIZZA_SIZES.map((s) => [s.key, ""])),
  flavorAllowedCategoryIds: [],
  flavorPriceMode: "average",
  crustEnabled: false,
  crustAllowedCategoryIds: [],
  addonIds: [],
  productOptions: [],
});
const emptyCategoryForm = (): CategoryFormState => ({
  name: "",
  slug: "",
  description: "",
  sortOrder: "0",
  active: true,
});

function slugifyCategoryName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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

function buildFlavorConfigPayload(form: FormState): FlavorConfig {
  const maxFlavors = Math.max(1, parseInt(form.flavorMax) || 1);
  const maxFlavorsBySize = Object.fromEntries(
    Object.entries(form.flavorMaxBySize)
      .map(([size, value]) => [size, Math.max(1, parseInt(value) || 0)] as const)
      .filter(([, value]) => value > 0)
  );
  return {
    enabled: form.flavorEnabled,
    maxFlavors,
    maxFlavorsBySize,
    allowedCategoryIds: form.flavorAllowedCategoryIds.map((id) => parseInt(id)).filter((id) => id > 0),
    priceMode: form.flavorPriceMode,
  };
}

function normalizeFlavorConfig(value: unknown): FlavorConfig {
  const config = (value && typeof value === "object" ? value : {}) as Partial<FlavorConfig>;
  return {
    enabled: Boolean(config.enabled),
    maxFlavors: Math.max(1, Number(config.maxFlavors) || 1),
    maxFlavorsBySize: config.maxFlavorsBySize ?? {},
    allowedCategoryIds: Array.isArray(config.allowedCategoryIds) ? config.allowedCategoryIds : [],
    priceMode: config.priceMode === "base" ? "base" : "average",
  };
}

function normalizeCrustConfig(value: unknown): CrustConfig {
  const config = (value && typeof value === "object" ? value : {}) as Partial<CrustConfig>;
  return {
    enabled: Boolean(config.enabled),
    allowedCategoryIds: Array.isArray(config.allowedCategoryIds) ? config.allowedCategoryIds : [],
  };
}

function makeOptionId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeProductOptions(value: unknown): ProductOptionGroup[] {
  if (!Array.isArray(value)) return [];
  return value.map((group, groupIndex) => {
    const normalizedGroup = (group && typeof group === "object" ? group : {}) as {
      id?: unknown;
      name?: unknown;
      required?: unknown;
      selectionMode?: unknown;
      sourceCategoryIds?: unknown;
      choices?: unknown;
    };
    const choices = Array.isArray(normalizedGroup.choices) ? normalizedGroup.choices : [];
    return {
      id: typeof normalizedGroup.id === "string" ? normalizedGroup.id : `group-${groupIndex}`,
      name: typeof normalizedGroup.name === "string" ? normalizedGroup.name : "",
      required: normalizedGroup.required !== false,
      selectionMode: normalizedGroup.selectionMode === "multiple" ? "multiple" : "single",
      sourceCategoryIds: Array.isArray(normalizedGroup.sourceCategoryIds)
        ? normalizedGroup.sourceCategoryIds.map(String)
        : [],
      choices: choices.map((choice, choiceIndex) => {
        const normalizedChoice = (choice && typeof choice === "object" ? choice : {}) as {
          id?: unknown;
          name?: unknown;
          priceDelta?: unknown;
        };
        return {
          id: typeof normalizedChoice.id === "string" ? normalizedChoice.id : `choice-${groupIndex}-${choiceIndex}`,
          name: typeof normalizedChoice.name === "string" ? normalizedChoice.name : "",
          priceDelta: normalizedChoice.priceDelta != null ? String(normalizedChoice.priceDelta) : "",
        };
      }),
    };
  });
}

function buildProductOptionsPayload(options: ProductOptionGroup[]) {
  return options
    .map((group) => {
      const choices = group.choices
        .map((choice) => ({
          id: choice.id,
          name: choice.name.trim(),
          priceDelta: choice.priceDelta === "" ? 0 : parseFloat(choice.priceDelta) || 0,
        }))
        .filter((choice) => choice.name);
      const sourceCategoryIds = group.sourceCategoryIds.map((id) => parseInt(id)).filter((id) => id > 0);

      return {
        id: group.id,
        name: group.name.trim(),
        required: group.required,
        selectionMode: group.selectionMode,
        sourceCategoryIds,
        choices,
      };
    })
    .filter((group) => group.name && (group.choices.length > 0 || group.sourceCategoryIds.length > 0));
}

function buildCrustConfigPayload(form: FormState): CrustConfig {
  return {
    enabled: form.crustEnabled,
    allowedCategoryIds: form.crustAllowedCategoryIds.map((id) => parseInt(id)).filter((id) => id > 0),
  };
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
  flavorConfig?: unknown;
  crustConfig?: unknown;
  addons?: { id: number }[];
  productOptions?: unknown;
}): FormState {
  const prices = item.prices as Record<string, number>;
  const sizes = item.availableSizes as string[];
  const isUnico = sizes.length === 1 && sizes[0] === "unico";
  const flavorConfig = normalizeFlavorConfig(item.flavorConfig);
  const crustConfig = normalizeCrustConfig(item.crustConfig);
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
    sizePrices: PRODUCT_SIZES.map((s) => ({
      size: s.key,
      price: prices[s.key] !== undefined ? String(prices[s.key]) : "",
    })),
    flavorEnabled: flavorConfig.enabled,
    flavorMax: String(flavorConfig.maxFlavors),
    flavorMaxBySize: Object.fromEntries(PIZZA_SIZES.map((s) => [
      s.key,
      flavorConfig.maxFlavorsBySize[s.key] ? String(flavorConfig.maxFlavorsBySize[s.key]) : "",
    ])),
    flavorAllowedCategoryIds: flavorConfig.allowedCategoryIds.map(String),
    flavorPriceMode: flavorConfig.priceMode,
    crustEnabled: crustConfig.enabled,
    crustAllowedCategoryIds: crustConfig.allowedCategoryIds.map(String),
    addonIds: Array.isArray(item.addons) ? item.addons.map((addon) => String(addon.id)) : [],
    productOptions: normalizeProductOptions(item.productOptions),
  };
}

export default function AdminMenu() {
  const utils = trpc.useUtils();
  const { data: categories } = trpc.categories.list.useQuery({ onlyActive: false });
  const { data: pizzas, isLoading } = trpc.pizzas.list.useQuery({ onlyActive: false });
  const { data: addons } = trpc.addons.list.useQuery({ onlyActive: true });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(emptyCategoryForm());
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

  const createCategory = trpc.categories.create.useMutation({
    onSuccess: () => {
      toast.success("Categoria criada com sucesso!");
      utils.categories.list.invalidate();
      setCategoryDialogOpen(false);
    },
    onError: (e) => toast.error("Erro ao criar categoria", { description: e.message }),
  });

  const updateCategory = trpc.categories.update.useMutation({
    onSuccess: () => {
      toast.success("Categoria atualizada!");
      utils.categories.list.invalidate();
      utils.pizzas.list.invalidate();
      utils.pizzas.featured.invalidate();
      setCategoryDialogOpen(false);
    },
    onError: (e) => toast.error("Erro ao atualizar categoria", { description: e.message }),
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

  function openCreateCategory() {
    setEditingCategoryId(null);
    setCategoryForm(emptyCategoryForm());
    setCategoryDialogOpen(true);
  }

  function openEditCategory(category: NonNullable<typeof categories>[number]) {
    setEditingCategoryId(category.id);
    setCategoryForm({
      name: category.name,
      slug: category.slug,
      description: category.description ?? "",
      sortOrder: String(category.sortOrder ?? 0),
      active: category.active,
    });
    setCategoryDialogOpen(true);
  }

  function setCategoryField<K extends keyof CategoryFormState>(key: K, value: CategoryFormState[K]) {
    setCategoryForm((current) => {
      if (key === "name") {
        const nextName = String(value);
        const currentAutoSlug = slugifyCategoryName(current.name);
        const shouldSyncSlug = !current.slug.trim() || current.slug === currentAutoSlug;
        return {
          ...current,
          name: nextName,
          slug: shouldSyncSlug ? slugifyCategoryName(nextName) : current.slug,
        };
      }
      if (key === "slug") {
        return { ...current, slug: slugifyCategoryName(String(value)) };
      }
      return { ...current, [key]: value };
    });
  }

  function handleCategorySubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = categoryForm.name.trim();
    const slug = slugifyCategoryName(categoryForm.slug || categoryForm.name);
    if (!name) { toast.error("Nome da categoria e obrigatorio"); return; }
    if (!slug) { toast.error("Slug da categoria e obrigatorio"); return; }

    const payload = {
      name,
      slug,
      description: categoryForm.description.trim() || undefined,
      sortOrder: parseInt(categoryForm.sortOrder) || 0,
      active: categoryForm.active,
    };

    if (editingCategoryId) {
      updateCategory.mutate({ id: editingCategoryId, ...payload });
    } else {
      createCategory.mutate(payload);
    }
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

  function setFlavorSizeLimit(sizeKey: string, value: string) {
    setForm((f) => ({
      ...f,
      flavorMaxBySize: { ...f.flavorMaxBySize, [sizeKey]: value },
    }));
  }

  function toggleFlavorCategory(categoryId: string) {
    setForm((f) => ({
      ...f,
      flavorAllowedCategoryIds: f.flavorAllowedCategoryIds.includes(categoryId)
        ? f.flavorAllowedCategoryIds.filter((id) => id !== categoryId)
        : [...f.flavorAllowedCategoryIds, categoryId],
    }));
  }

  function toggleCrustCategory(categoryId: string) {
    setForm((f) => ({
      ...f,
      crustAllowedCategoryIds: f.crustAllowedCategoryIds.includes(categoryId)
        ? f.crustAllowedCategoryIds.filter((id) => id !== categoryId)
        : [...f.crustAllowedCategoryIds, categoryId],
    }));
  }

  function toggleAddon(addonId: string) {
    setForm((f) => ({
      ...f,
      addonIds: f.addonIds.includes(addonId)
        ? f.addonIds.filter((id) => id !== addonId)
        : [...f.addonIds, addonId],
    }));
  }

  function addOptionGroup() {
    setForm((f) => ({
      ...f,
      productOptions: [
        ...f.productOptions,
        {
          id: makeOptionId("group"),
          name: "Opcao",
          required: true,
          selectionMode: "single",
          sourceCategoryIds: [],
          choices: [
            { id: makeOptionId("choice"), name: "", priceDelta: "" },
            { id: makeOptionId("choice"), name: "", priceDelta: "" },
          ],
        },
      ],
    }));
  }

  function updateOptionGroup(groupId: string, patch: Partial<ProductOptionGroup>) {
    setForm((f) => ({
      ...f,
      productOptions: f.productOptions.map((group) => group.id === groupId ? { ...group, ...patch } : group),
    }));
  }

  function toggleOptionCategory(groupId: string, categoryId: string) {
    setForm((f) => ({
      ...f,
      productOptions: f.productOptions.map((group) =>
        group.id === groupId
          ? {
              ...group,
              sourceCategoryIds: group.sourceCategoryIds.includes(categoryId)
                ? group.sourceCategoryIds.filter((id) => id !== categoryId)
                : [...group.sourceCategoryIds, categoryId],
            }
          : group
      ),
    }));
  }

  function removeOptionGroup(groupId: string) {
    setForm((f) => ({
      ...f,
      productOptions: f.productOptions.filter((group) => group.id !== groupId),
    }));
  }

  function addOptionChoice(groupId: string) {
    setForm((f) => ({
      ...f,
      productOptions: f.productOptions.map((group) =>
        group.id === groupId
          ? { ...group, choices: [...group.choices, { id: makeOptionId("choice"), name: "", priceDelta: "" }] }
          : group
      ),
    }));
  }

  function updateOptionChoice(groupId: string, choiceId: string, patch: Partial<ProductOptionChoice>) {
    setForm((f) => ({
      ...f,
      productOptions: f.productOptions.map((group) =>
        group.id === groupId
          ? {
              ...group,
              choices: group.choices.map((choice) => choice.id === choiceId ? { ...choice, ...patch } : choice),
            }
          : group
      ),
    }));
  }

  function removeOptionChoice(groupId: string, choiceId: string) {
    setForm((f) => ({
      ...f,
      productOptions: f.productOptions.map((group) =>
        group.id === groupId
          ? { ...group, choices: group.choices.filter((choice) => choice.id !== choiceId) }
          : group
      ),
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    if (!form.categoryId) { toast.error("Selecione uma categoria"); return; }

    const { prices, availableSizes } = buildPricesPayload(form);
    if (availableSizes.length === 0) { toast.error("Informe pelo menos um preço"); return; }

    const productOptions = buildProductOptionsPayload(form.productOptions);
    const invalidOptionGroup = form.productOptions.find((group) => {
      if (!group.name.trim()) return false;
      const hasManualChoice = group.choices.some((choice) => choice.name.trim());
      const hasCategoryChoice = group.sourceCategoryIds.length > 0;
      return !hasManualChoice && !hasCategoryChoice;
    });
    if (invalidOptionGroup) {
      toast.error("Opcao do produto incompleta", {
        description: `Em "${invalidOptionGroup.name}", cadastre pelo menos uma escolha ou selecione uma categoria.`,
      });
      return;
    }

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
      flavorConfig: buildFlavorConfigPayload(form),
      crustConfig: buildCrustConfigPayload(form),
      productOptions,
      addonIds: form.addonIds.map((id) => parseInt(id)).filter((id) => id > 0),
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
  const isCategoryPending = createCategory.isPending || updateCategory.isPending;

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

      {/* Categories management */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div>
            <h2 className="font-serif text-lg font-semibold text-foreground">Categorias</h2>
            <p className="text-xs text-muted-foreground">Cadastre, edite, ative ou desative categorias exibidas no cardapio publico.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={openCreateCategory} className="border-border gap-2">
            <Plus className="w-3.5 h-3.5" />
            Nova categoria
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories?.map((cat) => (
            <div
              key={cat.id}
              className={`flex items-center gap-3 rounded-full border px-3 py-2 ${
                cat.active ? "border-border bg-background/40" : "border-border/40 bg-muted/30 opacity-60"
              }`}
            >
              <span className="text-sm text-foreground">{cat.name}</span>
              <Badge variant={cat.active ? "default" : "secondary"} className="text-[10px]">
                {cat.active ? "Ativa" : "Inativa"}
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => openEditCategory(cat)}
                className="h-7 w-7"
                aria-label={`Editar categoria ${cat.name}`}
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Switch
                checked={cat.active}
                disabled={updateCategory.isPending}
                onCheckedChange={(active) => updateCategory.mutate({ id: cat.id, active })}
                aria-label={`${cat.active ? "Desativar" : "Ativar"} categoria ${cat.name}`}
              />
            </div>
          ))}
        </div>
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
                  {(item as any).flavorConfig?.enabled && (
                    <p className="text-[10px] text-primary">até {(item as any).flavorConfig.maxFlavors ?? 1} sabores</p>
                  )}
                  {Array.isArray((item as any).productOptions) && (item as any).productOptions.length > 0 && (
                    <p className="text-[10px] text-primary">{(item as any).productOptions.length} opcao{(item as any).productOptions.length > 1 ? "es" : ""}</p>
                  )}
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

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={(o) => !o && setCategoryDialogOpen(false)}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-foreground">
              {editingCategoryId ? "Editar Categoria" : "Nova Categoria"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCategorySubmit} className="space-y-4 pt-2">
            <div>
              <Label className="text-sm font-medium text-foreground mb-1.5 block">Nome *</Label>
              <Input
                value={categoryForm.name}
                onChange={(e) => setCategoryField("name", e.target.value)}
                placeholder="Ex: Pizzas Tradicionais"
                className="bg-input border-border"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-foreground mb-1.5 block">Slug *</Label>
              <Input
                value={categoryForm.slug}
                onChange={(e) => setCategoryField("slug", e.target.value)}
                placeholder="Ex: pizzas-tradicionais"
                className="bg-input border-border"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-foreground mb-1.5 block">Descricao</Label>
              <Input
                value={categoryForm.description}
                onChange={(e) => setCategoryField("description", e.target.value)}
                placeholder="Texto opcional"
                className="bg-input border-border"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
              <div>
                <Label className="text-sm font-medium text-foreground mb-1.5 block">Ordem</Label>
                <Input
                  type="number"
                  value={categoryForm.sortOrder}
                  onChange={(e) => setCategoryField("sortOrder", e.target.value)}
                  className="bg-input border-border"
                />
              </div>
              <div className="flex items-center gap-3 pb-2">
                <Switch
                  checked={categoryForm.active}
                  onCheckedChange={(checked) => setCategoryField("active", checked)}
                  id="category-active"
                />
                <Label htmlFor="category-active" className="text-sm text-foreground cursor-pointer">
                  Ativa no cardapio
                </Label>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCategoryDialogOpen(false)}
                className="flex-1 border-border"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isCategoryPending}
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isCategoryPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
                ) : (
                  editingCategoryId ? "Salvar Categoria" : "Criar Categoria"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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
                  {PRODUCT_SIZES.map((s) => {
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

            {/* Crust options */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="crustEnabled" className="text-sm font-medium text-foreground cursor-pointer">
                    Permitir borda recheada
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Escolha categorias com produtos de borda para aparecerem neste item.
                  </p>
                </div>
                <Switch
                  checked={form.crustEnabled}
                  onCheckedChange={(v) => setField("crustEnabled", v)}
                  id="crustEnabled"
                />
              </div>

              {form.crustEnabled && (
                <div className="rounded-xl border border-border p-4">
                  <Label className="text-sm font-medium text-foreground mb-3 block">Categorias de borda</Label>
                  <div className="flex flex-wrap gap-2">
                    {categories?.map((cat) => {
                      const selected = form.crustAllowedCategoryIds.includes(String(cat.id));
                      return (
                        <button
                          type="button"
                          key={cat.id}
                          onClick={() => toggleCrustCategory(String(cat.id))}
                          className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                            selected
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border text-muted-foreground hover:border-primary/50"
                          }`}
                        >
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Cadastre as bordas como produtos em uma categoria propria e selecione essa categoria aqui.
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Addons */}
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-foreground">Adicionais</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Marque os adicionais ativos que o cliente podera selecionar neste produto.
                </p>
              </div>

              {addons && addons.length > 0 ? (
                <div className="rounded-xl border border-border p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {addons.map((addon) => {
                      const selected = form.addonIds.includes(String(addon.id));
                      return (
                        <button
                          type="button"
                          key={addon.id}
                          onClick={() => toggleAddon(String(addon.id))}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            selected
                              ? "bg-primary/10 border-primary text-primary"
                              : "border-border text-muted-foreground hover:border-primary/50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium">{addon.name}</span>
                            <span className="text-xs">R$ {Number(addon.price).toFixed(2)}</span>
                          </div>
                          {addon.description && (
                            <p className="text-xs text-muted-foreground mt-1">{addon.description}</p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Cadastre adicionais ativos em Admin &gt; Adicionais para vincular ao produto.
                </div>
              )}
            </div>

            <Separator />

            {/* Product options */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="text-sm font-medium text-foreground">Opcoes do produto</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Configure escolhas como arroz do sushi, ponto, molho ou qualquer variacao do item.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addOptionGroup} className="border-border gap-2">
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar
                </Button>
              </div>

              {form.productOptions.length > 0 && (
                <div className="space-y-3">
                  {form.productOptions.map((group) => (
                    <div key={group.id} className="rounded-xl border border-border p-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-3 items-end">
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1.5 block">Nome da opcao que aparece para o cliente</Label>
                          <Input
                            value={group.name}
                            onChange={(e) => updateOptionGroup(group.id, { name: e.target.value })}
                            placeholder="Ex: Arroz, Molho, Peixe ou Tamanho"
                            className="bg-input border-border"
                          />
                        </div>
                        <div className="flex items-center gap-2 pb-2">
                          <Switch
                            checked={group.required}
                            onCheckedChange={(checked) => updateOptionGroup(group.id, { required: checked })}
                            id={`required-${group.id}`}
                          />
                          <Label htmlFor={`required-${group.id}`} className="text-xs text-foreground cursor-pointer">
                            Obrigatorio
                          </Label>
                        </div>
                        <div className="flex items-center gap-2 pb-2">
                          <Switch
                            checked={group.selectionMode === "multiple"}
                            onCheckedChange={(checked) => updateOptionGroup(group.id, { selectionMode: checked ? "multiple" : "single" })}
                            id={`multiple-${group.id}`}
                          />
                          <Label htmlFor={`multiple-${group.id}`} className="text-xs text-foreground cursor-pointer">
                            Permitir varias escolhas
                          </Label>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeOptionGroup(group.id)}
                          className="h-9 w-9 hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      <div>
                        <Label className="text-xs text-muted-foreground mb-2 block">Categorias de produtos (opcional)</Label>
                        <div className="flex flex-wrap gap-2">
                          {categories?.map((cat) => {
                            const selected = group.sourceCategoryIds.includes(String(cat.id));
                            return (
                              <button
                                type="button"
                                key={cat.id}
                                onClick={() => toggleOptionCategory(group.id, String(cat.id))}
                                className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                                  selected
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "border-border text-muted-foreground hover:border-primary/50"
                                }`}
                              >
                                {cat.name}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Opcional: use somente quando as escolhas vierem de produtos ja cadastrados. Para opcoes simples, preencha as escolhas abaixo.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground block">Escolhas dessa opcao</Label>
                        {group.choices.map((choice) => (
                          <div key={choice.id} className="grid grid-cols-[1fr_100px_auto] gap-2 items-center">
                            <Input
                              value={choice.name}
                              onChange={(e) => updateOptionChoice(group.id, choice.id, { name: e.target.value })}
                              placeholder="Ex: Tilapia, Salmao, Copo ou Jarra"
                              className="bg-input border-border h-8 text-sm"
                            />
                            <Input
                              type="number"
                              step="0.01"
                              value={choice.priceDelta}
                              onChange={(e) => updateOptionChoice(group.id, choice.id, { priceDelta: e.target.value })}
                              placeholder="+ R$"
                              className="bg-input border-border h-8 text-sm"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeOptionChoice(group.id, choice.id)}
                              className="h-8 w-8 hover:text-destructive"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => addOptionChoice(group.id)}
                        className="text-primary hover:text-primary hover:bg-primary/10"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Nova escolha
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Flavor selection */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="flavorEnabled" className="text-sm font-medium text-foreground cursor-pointer">
                    Permitir seleção de sabores
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Use para meio a meio, Trem, Bi-Trem, sushi ou combos com escolha de sabores.
                  </p>
                </div>
                <Switch
                  checked={form.flavorEnabled}
                  onCheckedChange={(v) => setField("flavorEnabled", v)}
                  id="flavorEnabled"
                />
              </div>

              {form.flavorEnabled && (
                <div className="space-y-4 rounded-xl border border-border p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-foreground mb-1.5 block">Quantidade máxima de sabores</Label>
                      <Input
                        type="number"
                        min="1"
                        max="20"
                        value={form.flavorMax}
                        onChange={(e) => setField("flavorMax", e.target.value)}
                        className="bg-input border-border"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-foreground mb-1.5 block">Preço quando misturar</Label>
                      <Select value={form.flavorPriceMode} onValueChange={(v) => setField("flavorPriceMode", v as FlavorPriceMode)}>
                        <SelectTrigger className="bg-input border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          <SelectItem value="average">Média dos sabores</SelectItem>
                          <SelectItem value="base">Preço do item principal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {form.priceMode === "sizes" && (
                    <div>
                      <Label className="text-sm font-medium text-foreground mb-3 block">
                        Limite por tamanho <span className="text-muted-foreground font-normal">(opcional)</span>
                      </Label>
                      <div className="grid grid-cols-2 gap-3">
                        {PIZZA_SIZES.map((s) => (
                          <div key={s.key} className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-28 flex-shrink-0">{s.label}</span>
                            <Input
                              type="number"
                              min="1"
                              max="20"
                              value={form.flavorMaxBySize[s.key] ?? ""}
                              onChange={(e) => setFlavorSizeLimit(s.key, e.target.value)}
                              placeholder={form.flavorMax}
                              className="bg-input border-border h-8 text-sm"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className="text-sm font-medium text-foreground mb-3 block">Categorias que podem ser selecionadas</Label>
                    <div className="flex flex-wrap gap-2">
                      {categories?.map((cat) => {
                        const selected = form.flavorAllowedCategoryIds.includes(String(cat.id));
                        return (
                          <button
                            type="button"
                            key={cat.id}
                            onClick={() => toggleFlavorCategory(String(cat.id))}
                            className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                              selected
                                ? "bg-primary text-primary-foreground border-primary"
                                : "border-border text-muted-foreground hover:border-primary/50"
                            }`}
                          >
                            {cat.name}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Se nenhuma categoria for marcada, o cliente escolhe itens da mesma categoria.
                    </p>
                  </div>
                </div>
              )}
            </div>

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
