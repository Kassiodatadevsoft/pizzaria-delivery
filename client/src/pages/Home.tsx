import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { ArrowRight, Star, Clock, Shield } from "lucide-react";
import PizzaCard from "@/components/PizzaCard";

export default function Home() {
  const [, navigate] = useLocation();
  const { data: featured, isLoading } = trpc.pizzas.featured.useQuery();
  const { data: allPizzas } = trpc.pizzas.list.useQuery({ onlyActive: true });

  return (
    <div className="min-h-screen">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1600&q=80')",
          }}
        />
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background" />

        <div className="relative container text-center z-10 pt-24 pb-32">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-6">
            <Star className="w-3.5 h-3.5 text-primary fill-primary" />
            <span className="text-xs text-primary font-medium tracking-wide uppercase">
              Delivery Premium
            </span>
          </div>

          <h1 className="font-serif text-5xl md:text-7xl font-bold text-foreground leading-tight mb-6">
            A melhor pizza
            <br />
            <span className="gold-shimmer">na sua porta</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed">
            Ingredientes selecionados, receitas artesanais e entrega rápida para você
            desfrutar do melhor da culinária italiana.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => navigate("/cardapio")}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold h-14 px-8 text-base"
            >
              Ver Cardápio
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/cardapio")}
              className="border-border text-foreground hover:bg-secondary h-14 px-8 text-base"
            >
              Fazer Pedido
            </Button>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-8 mt-16">
            {[
              { icon: Star, label: "4.9 estrelas", sub: "Avaliação média" },
              { icon: Clock, label: "30–45 min", sub: "Tempo de entrega" },
              { icon: Shield, label: "100% seguro", sub: "Pagamento protegido" },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <Icon className="w-5 h-5 text-primary mb-1" />
                <span className="text-sm font-semibold text-foreground">{label}</span>
                <span className="text-xs text-muted-foreground">{sub}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured Pizzas ──────────────────────────────────────────────── */}
      <section className="py-20 bg-background">
        <div className="container">
          <div className="text-center mb-12">
            <p className="text-primary text-sm font-medium uppercase tracking-widest mb-2">
              Destaques
            </p>
            <h2 className="font-serif text-4xl font-bold text-foreground mb-4">
              Nossas Especialidades
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Selecionamos as pizzas mais amadas pelos nossos clientes para você.
            </p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-80 rounded-2xl bg-card animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featured?.map((pizza) => (
                <PizzaCard key={pizza.id} pizza={pizza} allPizzas={allPizzas ?? featured ?? []} />
              ))}
            </div>
          )}

          <div className="text-center mt-12">
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate("/cardapio")}
              className="border-primary/40 text-primary hover:bg-primary/10 h-12 px-8"
            >
              Ver Cardápio Completo
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="py-20 bg-card">
        <div className="container">
          <div className="text-center mb-12">
            <p className="text-primary text-sm font-medium uppercase tracking-widest mb-2">
              Simples assim
            </p>
            <h2 className="font-serif text-4xl font-bold text-foreground mb-4">
              Como funciona
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
            {[
              { step: "01", title: "Escolha suas pizzas", desc: "Navegue pelo cardápio e adicione ao carrinho." },
              { step: "02", title: "Informe seu endereço", desc: "Preencha o endereço de entrega e escolha como pagar." },
              { step: "03", title: "Aguarde e aproveite", desc: "Acompanhe o status do pedido em tempo real." },
            ].map(({ step, title, desc }) => (
              <div key={step} className="text-center group">
                <div className="w-16 h-16 rounded-full border-2 border-primary/30 flex items-center justify-center mx-auto mb-4 group-hover:border-primary transition-colors">
                  <span className="font-serif text-xl font-bold text-primary">{step}</span>
                </div>
                <h3 className="font-semibold text-foreground mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-background">
        <div className="container">
          <div
            className="relative rounded-3xl overflow-hidden p-12 text-center"
            style={{
              background: "linear-gradient(135deg, oklch(0.18 0.04 60), oklch(0.14 0.02 60))",
              border: "1px solid oklch(0.75 0.14 75 / 0.2)",
            }}
          >
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 30% 50%, oklch(0.75 0.14 75), transparent 60%)",
              }}
            />
            <div className="relative">
              <h2 className="font-serif text-4xl font-bold text-foreground mb-4">
                Pronto para pedir?
              </h2>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                Faça seu pedido agora e receba em até 45 minutos.
              </p>
              <Button
                size="lg"
                onClick={() => navigate("/cardapio")}
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold h-14 px-10 text-base"
              >
                Pedir Agora
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 bg-card">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🍕</span>
            <span className="font-serif font-semibold text-foreground">Pizzaria Prime</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Pizzaria Prime. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
