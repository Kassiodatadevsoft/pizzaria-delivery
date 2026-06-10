import { useState } from "react";
import { MessageCircle, Copy, CheckCheck, Link2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function ShareLink() {
  const [copied, setCopied] = useState(false);
  const [clientName, setClientName] = useState("");

  const baseUrl = window.location.origin;

  const buildMessage = () => {
    const greeting = clientName.trim()
      ? `Olá, ${clientName.trim()}! 👋`
      : "Olá! 👋";
    return (
      `${greeting}\n\n` +
      `Aqui é a *Pizzaria Prime*! 🍕\n\n` +
      `Acesse nosso cardápio e faça seu pedido direto pelo link abaixo:\n\n` +
      `👉 ${baseUrl}\n\n` +
      `Escolha suas pizzas, hambúrgueres, petiscos e bebidas favoritas e finalize o pedido em poucos cliques. Sem app, sem complicação! 😄\n\n` +
      `Qualquer dúvida, estamos à disposição!`
    );
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(baseUrl);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    const message = encodeURIComponent(buildMessage());
    window.open(`https://wa.me/?text=${message}`, "_blank");
  };

  const handleWhatsAppDirect = () => {
    if (!clientName.trim()) {
      toast.error("Informe o número do cliente para envio direto.");
      return;
    }
    // Tenta abrir com número se clientName for um número
    const phone = clientName.replace(/\D/g, "");
    if (phone.length >= 10) {
      const message = encodeURIComponent(buildMessage());
      window.open(`https://wa.me/55${phone}?text=${message}`, "_blank");
    } else {
      handleWhatsApp();
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="container max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#25D366]/10 border border-[#25D366]/20 mb-4">
            <MessageCircle className="w-8 h-8 text-[#25D366]" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-foreground mb-2">
            Compartilhar Cardápio
          </h1>
          <p className="text-muted-foreground">
            Envie o link do sistema para seus clientes fazerem o pedido direto pelo navegador.
          </p>
        </div>

        {/* Link do sistema */}
        <div className="bg-card rounded-2xl border border-border p-6 mb-6">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary" />
            Link do Sistema
          </h2>
          <div className="flex gap-2">
            <Input
              readOnly
              value={baseUrl}
              className="bg-input border-border font-mono text-sm text-muted-foreground"
            />
            <Button
              type="button"
              onClick={handleCopyLink}
              variant="outline"
              className="shrink-0 border-border hover:border-primary/50"
            >
              {copied ? (
                <CheckCheck className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Este é o link que o cliente acessa para ver o cardápio e fazer o pedido.
          </p>
        </div>

        {/* Enviar via WhatsApp */}
        <div className="bg-card rounded-2xl border border-border p-6 mb-6">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-[#25D366]" />
            Enviar via WhatsApp
          </h2>

          <div className="mb-4">
            <Label htmlFor="clientName" className="text-sm font-medium text-foreground mb-1.5 block">
              Nome ou número do cliente <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input
              id="clientName"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Ex: João Silva ou (99) 99999-9999"
              className="bg-input border-border"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Se informar um número de celular, o WhatsApp abrirá direto na conversa com o cliente.
            </p>
          </div>

          {/* Preview da mensagem */}
          <div className="bg-[#25D366]/5 border border-[#25D366]/20 rounded-xl p-4 mb-4">
            <p className="text-xs font-medium text-[#25D366] mb-2 uppercase tracking-wide">
              Prévia da mensagem
            </p>
            <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
              {buildMessage()}
            </pre>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              type="button"
              onClick={handleWhatsApp}
              className="flex-1 bg-[#25D366] hover:bg-[#20b858] text-white font-semibold gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              Abrir WhatsApp
            </Button>
            {clientName.replace(/\D/g, "").length >= 10 && (
              <Button
                type="button"
                onClick={handleWhatsAppDirect}
                variant="outline"
                className="flex-1 border-[#25D366]/40 text-[#25D366] hover:bg-[#25D366]/10 gap-2"
              >
                <Share2 className="w-4 h-4" />
                Enviar para {clientName.replace(/\D/g, "").length >= 10 ? "este número" : "cliente"}
              </Button>
            )}
          </div>
        </div>

        {/* Dica */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">💡 Dica:</span> Salve este link nos seus contatos favoritos do WhatsApp ou crie um atalho na tela inicial do celular para acessar rapidamente sempre que precisar enviar para um cliente.
          </p>
        </div>
      </div>
    </div>
  );
}
