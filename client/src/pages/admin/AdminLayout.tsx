import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import {
  ChefHat,
  Home,
  Key,
  Lock,
  LogOut,
  MessageCircle,
  ReceiptText,
  ShoppingBag,
  Truck,
  User,
  UtensilsCrossed,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

const NAV_ITEMS = [
  { href: "/admin/pedidos", label: "Pedidos", icon: ShoppingBag },
  { href: "/admin/delivery", label: "Delivery Online", icon: Truck },
  { href: "/admin/delivery/fechamento", label: "Fechamento", icon: ReceiptText },
  { href: "/admin/cardapio", label: "Cardapio", icon: UtensilsCrossed },
  { href: "/admin/compartilhar", label: "Compartilhar Link", icon: MessageCircle },
  { href: "/admin/api-keys", label: "API Keys (ERP)", icon: Key },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, isAuthenticated } = useAuth();
  const [location, navigate] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const utils = trpc.useUtils();

  const login = trpc.auth.login.useMutation({
    onSuccess: async () => {
      toast.success("Acesso liberado");
      const loggedUser = await utils.auth.me.fetch();
      utils.auth.me.setData(undefined, loggedUser);
      if (loggedUser?.role === "admin") {
        navigate("/admin/pedidos");
      }
    },
    onError: (error) => {
      toast.error("Nao foi possivel entrar", { description: error.message });
    },
  });

  const logout = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      toast.success("Sessao encerrada");
      await utils.auth.me.invalidate();
      navigate("/");
    },
  });

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    login.mutate({ username: username.trim(), password });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-lg">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <ChefHat className="w-7 h-7 text-primary" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-foreground">Painel Admin</h2>
            <p className="text-sm text-muted-foreground mt-1">Entre para gerenciar os pedidos.</p>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="admin-username" className="text-sm font-medium text-foreground">
                Usuario
              </Label>
              <div className="relative mt-1.5">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="admin-username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="pl-9 bg-input border-border"
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <Label htmlFor="admin-password" className="text-sm font-medium text-foreground">
                Senha
              </Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="pl-9 bg-input border-border"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={login.isPending}>
              {login.isPending ? "Entrando..." : "Entrar"}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <ChefHat className="w-16 h-16 text-primary mx-auto mb-4" />
          <h2 className="font-serif text-2xl font-bold text-foreground mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground mb-6">Esta area e exclusiva para administradores da Pizzaria Prime.</p>
          <button onClick={() => navigate("/")} className="text-primary hover:underline text-sm">
            Voltar ao inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 bg-card border-r border-border flex flex-col fixed h-screen z-40">
        <div className="shrink-0 p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <ChefHat className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-serif font-bold text-foreground text-sm">Pizzaria Prime</p>
              <p className="text-xs text-muted-foreground">Painel Admin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto p-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = location === item.href || (item.href === "/admin/pedidos" && location === "/admin");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 p-4 border-t border-border space-y-1">
          <Link
            href="/"
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
          >
            <Home className="w-4 h-4" />
            Ver site
          </Link>
          <button
            onClick={() => logout.mutate()}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-64 p-8 min-h-screen">{children}</main>
    </div>
  );
}
