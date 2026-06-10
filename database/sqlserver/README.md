# SQL Server

Use o mesmo banco de dados do ERP, mas mantenha as tabelas do delivery no schema `delivery`.

Exemplo de `DATABASE_URL`:

```text
Server=127.0.0.1,1433;Database=NomeDoBancoDoERP;User Id=usuario;Password=senha;TrustServerCertificate=true;Encrypt=false
```

Criar/atualizar as tabelas:

```bash
pnpm run db:push
```

Popular um cardapio inicial simples:

```bash
node scripts/seed-cardapio.mjs
```

As tabelas criadas ficam em:

- `delivery.users`
- `delivery.pizza_categories`
- `delivery.pizzas`
- `delivery.api_keys`
- `delivery.orders`
- `delivery.order_items`

