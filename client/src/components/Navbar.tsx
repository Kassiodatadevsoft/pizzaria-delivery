import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ShoppingCart, User, LogOut, LayoutDashboard, Menu, X } from "lucide-react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Navbar() {
  const { totalItems, openCart } = useCart();
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => window.location.reload(),
  });

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-md border-b border-border">
      <div className="container flex items-center justify-between h-16">
        {/* Logo */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 group"
        >
          <span className="text-2xl">🍕</span>
          <span className="font-serif text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
            Pizzaria Prime
          </span>
        </button>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6">
          <button
            onClick={() => navigate("/")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Início
          </button>
          <button
            onClick={() => navigate("/cardapio")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cardápio
          </button>
          {isAuthenticated && user?.role === "admin" && (
            <button
              onClick={() => navigate("/admin")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Admin
            </button>
          )}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Cart */}
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={openCart}
          >
            <ShoppingCart className="w-5 h-5" />
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center">
                {totalItems > 9 ? "9+" : totalItems}
              </span>
            )}
          </Button>

          {/* User */}
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <User className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium text-foreground truncate">{user?.name ?? "Usuário"}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/meus-pedidos")} className="cursor-pointer">
                  Meus Pedidos
                </DropdownMenuItem>
                {user?.role === "admin" && (
                  <DropdownMenuItem onClick={() => navigate("/admin")} className="cursor-pointer">
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Painel Admin
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => logout.mutate()}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = getLoginUrl()}
              className="hidden md:flex border-primary/40 text-primary hover:bg-primary/10"
            >
              Entrar
            </Button>
          )}

          {/* Mobile menu toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-card px-4 py-4 space-y-3">
          <button
            onClick={() => { navigate("/"); setMobileOpen(false); }}
            className="block w-full text-left text-sm text-muted-foreground hover:text-foreground py-2"
          >
            Início
          </button>
          <button
            onClick={() => { navigate("/cardapio"); setMobileOpen(false); }}
            className="block w-full text-left text-sm text-muted-foreground hover:text-foreground py-2"
          >
            Cardápio
          </button>
          {!isAuthenticated && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = getLoginUrl()}
              className="w-full border-primary/40 text-primary hover:bg-primary/10"
            >
              Entrar / Cadastrar
            </Button>
          )}
          {isAuthenticated && user?.role === "admin" && (
            <button
              onClick={() => { navigate("/admin"); setMobileOpen(false); }}
              className="block w-full text-left text-sm text-muted-foreground hover:text-foreground py-2"
            >
              Painel Admin
            </button>
          )}
        </div>
      )}
    </header>
  );
}
