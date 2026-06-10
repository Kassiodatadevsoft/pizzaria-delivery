import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { AlertCircle, CheckCircle, Clock, Copy, Key, Plus, Trash2 } from "lucide-react";

const ORDER_PAYLOAD_EXAMPLE = `{
  "delivery_order_id": "DLV-1001",
  "cliente": { "nome": "Maria Silva", "telefone": "11999999999" },
  "endereco": {
    "rua": "Rua das Flores",
    "numero": "123",
    "bairro": "Centro",
    "cidade": "Sao Paulo",
    "estado": "SP",
    "cep": "01000-000"
  },
  "forma_pagamento": "pix",
  "taxa_entrega": 7.5,
  "itens": [
    {
      "produto_id": 10,
      "produto_nome": "Pizza Calabresa",
      "tamanho": "grande",
      "tamanho_descricao": "Grande",
      "quantidade": 1,
      "preco_unitario": 59.9,
      "preco_total_item": 59.9
    }
  ]
}`;

export default function AdminApiKeys() {
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: keys, refetch } = trpc.apiKeys.list.useQuery();
  const createKey = trpc.apiKeys.create.useMutation({
    onSuccess: (data) => {
      setCreatedKey(data.raw);
      setShowKeyDialog(true);
      setNewKeyName("");
      refetch();
    },
    onError: () => toast.error("Erro ao criar API Key"),
  });
  const revokeKey = trpc.apiKeys.revoke.useMutation({
    onSuccess: () => {
      toast.success("API Key revogada com sucesso");
      refetch();
    },
    onError: () => toast.error("Erro ao revogar API Key"),
  });

  function handleCreate() {
    if (!newKeyName.trim()) {
      toast.error("Informe um nome para a API Key");
      return;
    }
    createKey.mutate({ name: newKeyName.trim() });
  }

  function handleCopy() {
    if (!createdKey) return;
    navigator.clipboard.writeText(createdKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Chave copiada para a area de transferencia!");
  }

  function formatDate(date: Date | null | undefined) {
    if (!date) return "Nunca utilizada";
    return new Date(date).toLocaleString("pt-BR");
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Key className="w-6 h-6 text-amber-500" />
          API Keys - Integracao Delivery/ERP
        </h1>
        <p className="text-muted-foreground mt-1">
          Gerencie as chaves de acesso para integracao com ERP, PDV ou sistema de delivery externo.
        </p>
      </div>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-amber-400">Como integrar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Adicione o header{" "}
            <code className="bg-muted px-1 rounded text-amber-300">Authorization: Bearer pk_live_xxx</code>{" "}
            em todas as requisicoes.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 font-mono text-xs">
            <div className="bg-muted rounded p-2">
              <span className="text-blue-400">POST</span> /api/erp/orders
              <div className="text-muted-foreground">Criar pedido vindo do delivery</div>
            </div>
            <div className="bg-muted rounded p-2">
              <span className="text-green-400">GET</span> /api/erp/orders/new
              <div className="text-muted-foreground">Pedidos novos (status=received)</div>
            </div>
            <div className="bg-muted rounded p-2">
              <span className="text-blue-400">POST</span> /api/erp/orders/:id/status
              <div className="text-muted-foreground">Atualizar status do pedido</div>
            </div>
            <div className="bg-muted rounded p-2">
              <span className="text-green-400">GET</span> /api/erp/products
              <div className="text-muted-foreground">Listar produtos com erpCode</div>
            </div>
            <div className="bg-muted rounded p-2">
              <span className="text-blue-400">POST</span> /api/erp/products/sync
              <div className="text-muted-foreground">Criar/atualizar produto do ERP</div>
            </div>
          </div>
          <p className="text-xs">
            <strong className="text-amber-400">Fluxo sugerido:</strong> sistemas externos podem enviar pedidos com{" "}
            <code className="bg-muted px-1 rounded">POST /api/erp/orders</code>. ERPs/PDVs podem consultar{" "}
            <code className="bg-muted px-1 rounded">/api/erp/orders/new</code> a cada 30-60 segundos e atualizar o
            status para <code className="bg-muted px-1 rounded">preparing</code>.
          </p>
          <pre className="overflow-x-auto rounded bg-muted p-3 text-xs text-muted-foreground">
            {ORDER_PAYLOAD_EXAMPLE}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Criar nova API Key</CardTitle>
          <CardDescription>De um nome descritivo, como "Delivery Producao" ou "ERP Delphi".</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Nome da chave"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="max-w-sm"
            />
            <Button
              onClick={handleCreate}
              disabled={createKey.isPending}
              className="bg-amber-500 hover:bg-amber-600 text-black"
            >
              <Plus className="w-4 h-4 mr-1" />
              {createKey.isPending ? "Criando..." : "Criar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chaves</CardTitle>
        </CardHeader>
        <CardContent>
          {!keys || keys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Nenhuma API Key criada ainda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${key.active ? "bg-green-500" : "bg-red-500"}`} />
                    <div>
                      <div className="font-medium text-sm">{key.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                        <span className="font-mono">{key.keyPrefix}********</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(key.lastUsedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={key.active ? "default" : "secondary"}>{key.active ? "Ativa" : "Revogada"}</Badge>
                    {key.active && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Revogar API Key?</AlertDialogTitle>
                            <AlertDialogDescription>
                              A chave <strong>{key.name}</strong> sera desativada imediatamente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-red-600 hover:bg-red-700"
                              onClick={() => revokeKey.mutate({ id: key.id })}
                            >
                              Revogar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={showKeyDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowKeyDialog(false);
            setCreatedKey(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-400">
              <CheckCircle className="w-5 h-5" />
              API Key criada com sucesso!
            </DialogTitle>
            <DialogDescription>
              Copie a chave abaixo agora. <strong className="text-red-400">Ela nao sera exibida novamente.</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted rounded-lg p-3 flex items-center gap-2">
              <code className="flex-1 text-sm text-amber-300 break-all font-mono">{createdKey}</code>
              <Button variant="ghost" size="sm" onClick={handleCopy} className="shrink-0">
                {copied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <div className="flex items-start gap-2 text-sm text-muted-foreground bg-amber-500/10 rounded p-3 border border-amber-500/20">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Use esta chave no header:{" "}
                <code className="text-amber-300">Authorization: Bearer {createdKey?.substring(0, 15)}...</code>
              </span>
            </div>
            <Button
              className="w-full bg-amber-500 hover:bg-amber-600 text-black"
              onClick={() => {
                handleCopy();
                setShowKeyDialog(false);
              }}
            >
              Copiar e fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
