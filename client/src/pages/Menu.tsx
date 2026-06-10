import { useState } from "react";
import { trpc } from "@/lib/trpc";
import PizzaCard from "@/components/PizzaCard";
import { Skeleton } from "@/components/ui/skeleton";

export default function Menu() {
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const { data: categories, isLoading: loadingCats } = trpc.categories.list.useQuery({ onlyActive: true });
  const { data: pizzas, isLoading: loadingPizzas } = trpc.pizzas.list.useQuery({ onlyActive: true });

  const filtered = activeCat
    ? pizzas?.filter((p) => p.categoryId === activeCat)
    : pizzas;

  return (
    <div className="min-h-screen pt-24 pb-16">
      {/* Header */}
      <div className="container mb-10">
        <div className="text-center">
          <p className="text-primary text-sm font-medium uppercase tracking-widest mb-2">
            Nosso Cardápio
          </p>
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-4">
            Cardápio Completo
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Pizzas, hambúrgueres, petiscos, bebidas e muito mais. Tudo com a qualidade Pizzaria Prime.
          </p>
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap justify-center gap-3 mt-8">
          <button
            onClick={() => setActiveCat(null)}
            className={`px-5 py-2 rounded-full text-sm font-medium border transition-all ${
              activeCat === null
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }`}
          >
            Todas
          </button>
          {loadingCats
            ? Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-24 rounded-full" />
              ))
            : categories?.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCat(cat.id)}
                  className={`px-5 py-2 rounded-full text-sm font-medium border transition-all ${
                    activeCat === cat.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
        </div>
      </div>

      {/* Pizza grid */}
      <div className="container">
        {loadingPizzas ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-80 rounded-2xl bg-card animate-pulse" />
            ))}
          </div>
        ) : filtered?.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <span className="text-5xl block mb-4">🍕</span>
            <p>Nenhuma pizza encontrada nesta categoria.</p>
          </div>
        ) : (
          <>
            {/* Group by category when showing all */}
            {activeCat === null
              ? categories?.map((cat) => {
                  const catPizzas = pizzas?.filter((p) => p.categoryId === cat.id) ?? [];
                  if (catPizzas.length === 0) return null;
                  return (
                    <div key={cat.id} className="mb-14">
                      <div className="flex items-center gap-4 mb-6">
                        <h2 className="font-serif text-2xl font-bold text-foreground">{cat.name}</h2>
                        <div className="flex-1 h-px bg-border" />
                        {cat.description && (
                          <p className="text-sm text-muted-foreground hidden md:block max-w-xs text-right">
                            {cat.description}
                          </p>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {catPizzas.map((pizza) => (
                          <PizzaCard key={pizza.id} pizza={pizza} allPizzas={pizzas ?? []} />
                        ))}
                      </div>
                    </div>
                  );
                })
              : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filtered?.map((pizza) => (
                    <PizzaCard key={pizza.id} pizza={pizza} allPizzas={pizzas ?? []} />
                  ))}
                </div>
              )}
          </>
        )}
      </div>
    </div>
  );
}
