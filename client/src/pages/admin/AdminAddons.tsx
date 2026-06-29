import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

type AddonForm = {
  name: string;
  description: string;
  price: string;
  active: boolean;
};

const emptyForm = (): AddonForm => ({
  name: "",
  description: "",
  price: "",
  active: true,
});

function formatCurrency(value: unknown) {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function AdminAddons() {
  const utils = trpc.useUtils();
  const { data: addons, isLoading } = trpc.addons.list.useQuery({ onlyActive: false });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<AddonForm>(emptyForm());

  const createAddon = trpc.addons.create.useMutation({
    onSuccess: () => {
      toast.success("Adicional criado");
      utils.addons.list.invalidate();
      utils.pizzas.list.invalidate();
      setDialogOpen(false);
    },
    onError: (error) => toast.error("Erro ao criar adicional", { description: error.message }),
  });

  const updateAddon = trpc.addons.update.useMutation({
    onSuccess: () => {
      toast.success("Adicional atualizado");
      utils.addons.list.invalidate();
      utils.pizzas.list.invalidate();
      setDialogOpen(false);
    },
    onError: (error) => toast.error("Erro ao atualizar adicional", { description: error.message }),
  });

  const deleteAddon = trpc.addons.delete.useMutation({
    onSuccess: () => {
      toast.success("Adicional inativado");
      utils.addons.list.invalidate();
      utils.pizzas.list.invalidate();
    },
    onError: (error) => toast.error("Erro ao inativar adicional", { description: error.message }),
  });

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function openEdit(addon: NonNullable<typeof addons>[number]) {
    setEditingId(addon.id);
    setForm({
      name: addon.name,
      description: addon.description ?? "",
      price: String(addon.price ?? ""),
      active: addon.active,
    });
    setDialogOpen(true);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const price = Number(form.price);
    if (!form.name.trim()) {
      toast.error("Nome e obrigatorio");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Informe um preco valido");
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price,
      active: form.active,
    };

    if (editingId) updateAddon.mutate({ id: editingId, ...payload });
    else createAddon.mutate(payload);
  }

  const pending = createAddon.isPending || updateAddon.isPending;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Adicionais</h1>
          <p className="text-muted-foreground text-sm mt-1">Cadastre extras que podem ser vinculados aos produtos.</p>
        </div>
        <Button onClick={openCreate} className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
          <Plus className="w-4 h-4" />
          Novo Adicional
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-16 bg-card rounded-xl animate-pulse" />
          ))}
        </div>
      ) : addons?.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center text-muted-foreground">
          Nenhum adicional cadastrado.
        </div>
      ) : (
        <div className="space-y-2">
          {addons?.map((addon) => (
            <div key={addon.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-foreground">{addon.name}</p>
                  <Badge variant={addon.active ? "default" : "secondary"}>{addon.active ? "Ativo" : "Inativo"}</Badge>
                </div>
                {addon.description && <p className="text-sm text-muted-foreground mt-1">{addon.description}</p>}
                <p className="text-xs text-muted-foreground mt-1">
                  Cadastro: {new Date(addon.createdAt).toLocaleString("pt-BR")} | Alteracao: {new Date(addon.updatedAt).toLocaleString("pt-BR")}
                </p>
              </div>
              <p className="text-primary font-bold">{formatCurrency(addon.price)}</p>
              <Button variant="ghost" size="icon" onClick={() => openEdit(addon)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteAddon.mutate({ id: addon.id })}
                disabled={deleteAddon.isPending || !addon.active}
                className="hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar adicional" : "Novo adicional"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-foreground mb-1.5 block">Nome *</Label>
              <Input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="bg-input border-border"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-foreground mb-1.5 block">Descricao</Label>
              <Input
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                className="bg-input border-border"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-foreground mb-1.5 block">Preco (R$) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
                className="bg-input border-border"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.active}
                onCheckedChange={(active) => setForm((current) => ({ ...current, active }))}
                id="addon-active"
              />
              <Label htmlFor="addon-active" className="text-sm text-foreground cursor-pointer">
                Ativo
              </Label>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1 border-border">
                Cancelar
              </Button>
              <Button type="submit" disabled={pending} className="flex-1">
                {pending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
