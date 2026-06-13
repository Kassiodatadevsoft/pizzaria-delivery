import "dotenv/config";
import sql from "mssql";

function getSqlServerConnectionConfig() {
  const raw = process.env.SQLSERVER_URL ?? process.env.DATABASE_URL;
  if (!raw) return undefined;
  if (!raw.startsWith("mssql://")) return raw;

  const url = new URL(raw);
  return {
    server: url.hostname,
    port: url.port ? Number(url.port) : 1433,
    database: url.pathname.replace(/^\//, ""),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    options: {
      encrypt: url.searchParams.get("encrypt") === "true",
      trustServerCertificate: url.searchParams.get("trustServerCertificate") !== "false",
    },
  };
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const connectionConfig = getSqlServerConnectionConfig();
if (!connectionConfig) {
  console.error("SQLSERVER_URL ou DATABASE_URL nao configurada.");
  process.exit(1);
}

const categories = [
  { slug: "entradas", name: "Entradas", description: "Entradas e porções individuais" },
  { slug: "carpaccio", name: "Carpaccio", description: "Carpaccio em porções" },
  { slug: "hot-harumaki", name: "Hot Harumaki", description: "Hot harumaki" },
  { slug: "hot-tradicionais", name: "Hot Tradicionais", description: "Hots tradicionais" },
  { slug: "rolinho-primavera", name: "Rolinho Primavera", description: "Rolinhos primavera" },
  { slug: "temaki", name: "Temaki", description: "Temakis" },
  { slug: "sashimi", name: "Sashimi", description: "Sashimis" },
  { slug: "niguiri", name: "Niguiri (4 peças)", description: "Niguiris com 4 peças" },
  { slug: "joy", name: "Joy (4 peças)", description: "Joys com 4 peças" },
  { slug: "uramaki-tradicional", name: "Uramaki Tradicional (5 peças)", description: "Uramakis tradicionais com 5 peças" },
  { slug: "uramaki-especiais", name: "Uramaki Especiais", description: "Uramakis especiais" },
  { slug: "hossomaki", name: "Hossomaki", description: "Hossomakis" },
  { slug: "gunkan", name: "Gunkan", description: "Gunkans" },
  { slug: "batera", name: "Batera", description: "Bateras" },
  { slug: "pokes", name: "Pokes", description: "Pokes" },
  { slug: "ceviche", name: "Ceviche", description: "Ceviches" },
  { slug: "sobremesa", name: "Sobremesa", description: "Sobremesas" },
  { slug: "hamburguer", name: "Hambúrguer", description: "Hambúrgueres" },
  { slug: "pizzas", name: "Pizzas", description: "Pizzas" },
  { slug: "camarao", name: "Camarão", description: "Pratos com camarão" },
  { slug: "combinados", name: "Combinados", description: "Combinados de sushi" },
  { slug: "sushi-hot-dog", name: "Sushi Hot Dog", description: "Sushi hot dog" },
  { slug: "adicionais", name: "Adicionais", description: "Adicionais e molhos" },
].map((category, index) => ({ ...category, sortOrder: index + 20 }));

const products = [
  ["entradas", "Sunomono", 15],
  ["entradas", "Misto", 18],
  ["entradas", "Osasco Salmão", 5.66],
  ["entradas", "Osasco Camarão", 7],
  ["entradas", "Osasco Mix", 7.5],

  ["carpaccio", "Carpaccio 12 peças", 35],
  ["carpaccio", "Carpaccio 20 peças", 55],

  ["hot-harumaki", "Hot Harumaki com arroz", 25],
  ["hot-harumaki", "Hot Harumaki sem arroz", 31],

  ["hot-tradicionais", "Hot Salmão", 23],
  ["hot-tradicionais", "Hot Camarão", 25],
  ["hot-tradicionais", "Hot Kani", 22],
  ["hot-tradicionais", "Hot Mix", 25],
  ["hot-tradicionais", "Hot Salmão e Camarão", 23],
  ["hot-tradicionais", "Hot Salmão com Crispy de Couve", 25],
  ["hot-tradicionais", "Hot Salmão e Camarão com Crispy de Batata Doce", 25.99],

  ["rolinho-primavera", "Romeu e Julieta", 18],
  ["rolinho-primavera", "Queijo Prime", 16],

  ["temaki", "Temaki Frio", 40],
  ["temaki", "Temaki Frito", 40],
  ["temaki", "Temaki sem arroz", 45],
  ["temaki", "Temaki Supremo", 50],

  ["sashimi", "Sashimi Especial", 28],
  ["sashimi", "Sashimi Marajoara", 30],
  ["sashimi", "Sashimi ao Molho Ponzu", 34],
  ["sashimi", "Sashimi Flambado", 28],
  ["sashimi", "Sashimi Empanado", 30],
  ["sashimi", "Sashimi Tilápia", 35],
  ["sashimi", "Sashimi Camarão Empanado", 35],

  ["niguiri", "Niguiri Salmão", 20],
  ["niguiri", "Niguiri Tilápia", 18],
  ["niguiri", "Niguiri Camarão", 22],
  ["niguiri", "Niguiri Skin", 15],
  ["niguiri", "Niguiri Kani", 18],

  ["joy", "Joy com arroz", 18],
  ["joy", "Joy sem arroz", 20],

  ["uramaki-tradicional", "Uramaki Salmão", 20],
  ["uramaki-tradicional", "Uramaki Camarão", 20],
  ["uramaki-tradicional", "Uramaki Kani", 20],
  ["uramaki-tradicional", "Uramaki Mix", 20],
  ["uramaki-tradicional", "Uramaki Salmão e Camarão", 20],
  ["uramaki-tradicional", "Uramaki Salmão e Kani", 20],
  ["uramaki-tradicional", "Uramaki Camarão e Kani", 20],
  ["uramaki-tradicional", "Uramaki California", 18],

  ["uramaki-especiais", "Uramaki Ebi Tempura", 25],
  ["uramaki-especiais", "Uramaki Filadélfia", 20],
  ["uramaki-especiais", "Uramaki Camarão Especial", 25],
  ["uramaki-especiais", "Uramaki Especial", 25],

  ["hossomaki", "Hossomaki Salmão", 25],
  ["hossomaki", "Hossomaki Camarão", 25],
  ["hossomaki", "Hossomaki Kani", 22],
  ["hossomaki", "Hossomaki Salmão e Camarão", 23],
  ["hossomaki", "Hossomaki Salmão e Kani", 23.99],

  ["gunkan", "Gunkan Salmão", 18],
  ["batera", "Batera Salmão", 30],

  ["pokes", "Poke Prime", 55],
  ["pokes", "Poke Salmão", 45],
  ["pokes", "Poke Salmão e Camarão", 50],

  ["ceviche", "Ceviche Tradicional", 48],
  ["ceviche", "Ceviche Salmão ao Molho de Maracujá", 42],

  ["sobremesa", "Banoffee Banana", 27],
  ["hamburguer", "Hambúrguer de Salmão", 34],

  ["pizzas", "Pizza Pequena (P)", 70],
  ["pizzas", "Pizza Média (M)", 80],
  ["pizzas", "Pizza Grande (G)", 90],

  ["camarao", "Camarão Empanado com Catupiry", 75],
  ["camarao", "Camarão Empanado com Queijo", 75],
  ["camarao", "Camarão Empanado com Creme Cheese", 65],
  ["camarao", "Camarão Alho e Óleo", 70],

  ["combinados", "Japa 20 peças", 65],
  ["combinados", "Prime 30 peças", 105],
  ["combinados", "Tokyo 15 peças", 60],
  ["combinados", "Osaka 20 peças", 80],

  ["sushi-hot-dog", "Hot Dog Sushi", 38],

  ["adicionais", "Molho Tarê", 2],
  ["adicionais", "Molho Shoyu", 2],
  ["adicionais", "Creme Cheese", 2],
  ["adicionais", "Geleia de Maracujá", 2],
  ["adicionais", "Wasabi", 2],
].map(([categorySlug, name, price], index) => ({
  categorySlug,
  name,
  description: "",
  prices: { unico: price },
  availableSizes: ["unico"],
  featured: false,
  sortOrder: index + 1,
}));

async function upsertCategory(pool, { slug, name, description, sortOrder }) {
  const result = await pool.request()
    .input("name", sql.NVarChar(100), name)
    .input("slug", sql.NVarChar(100), slug)
    .input("description", sql.NVarChar(sql.MAX), description)
    .input("sortOrder", sql.Int, sortOrder)
    .query(`
      MERGE delivery.pizza_categories AS target
      USING (SELECT @slug AS slug) AS source
      ON target.slug = source.slug
      WHEN MATCHED THEN UPDATE SET
        name = @name,
        description = @description,
        sortOrder = @sortOrder,
        active = 1,
        updatedAt = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (name, slug, description, sortOrder, active)
        VALUES (@name, @slug, @description, @sortOrder, 1)
      OUTPUT INSERTED.id;
    `);
  return result.recordset[0].id;
}

async function upsertProduct(pool, categoryId, product) {
  await pool.request()
    .input("categoryId", sql.Int, categoryId)
    .input("name", sql.NVarChar(150), product.name)
    .input("description", sql.NVarChar(sql.MAX), product.description || null)
    .input("prices", sql.NVarChar(sql.MAX), JSON.stringify(product.prices))
    .input("sizes", sql.NVarChar(sql.MAX), JSON.stringify(product.availableSizes))
    .input("featured", sql.Bit, product.featured)
    .input("active", sql.Bit, true)
    .input("sortOrder", sql.Int, product.sortOrder)
    .input("erpCode", sql.NVarChar(100), `SUSHI-${slugify(product.categorySlug)}-${slugify(product.name)}`.slice(0, 100))
    .query(`
      MERGE delivery.pizzas AS target
      USING (SELECT @categoryId AS categoryId, @name AS name) AS source
      ON target.erpCode = @erpCode OR (target.categoryId = source.categoryId AND target.name = source.name)
      WHEN MATCHED THEN UPDATE SET
        name = @name,
        description = @description,
        prices = @prices,
        availableSizes = @sizes,
        featured = @featured,
        active = @active,
        sortOrder = @sortOrder,
        erpCode = COALESCE(target.erpCode, @erpCode),
        updatedAt = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (categoryId, name, description, prices, availableSizes, erpCode, featured, active, sortOrder)
        VALUES (@categoryId, @name, @description, @prices, @sizes, @erpCode, @featured, @active, @sortOrder);
    `);
}

const pool = await sql.connect(connectionConfig);

try {
  const categoryIds = new Map();
  for (const category of categories) {
    categoryIds.set(category.slug, await upsertCategory(pool, category));
  }

  for (const product of products) {
    const categoryId = categoryIds.get(product.categorySlug);
    if (!categoryId) continue;
    await upsertProduct(pool, categoryId, product);
  }

  const summary = await pool.request().query(`
    SELECT c.name, COUNT(p.id) AS total
    FROM delivery.pizza_categories c
    LEFT JOIN delivery.pizzas p ON p.categoryId = c.id AND p.active = 1
    WHERE c.slug IN (${categories.map((_, index) => `@slug${index}`).join(", ")})
    GROUP BY c.name, c.sortOrder
    ORDER BY c.sortOrder;
  `.replace(
    /@slug(\d+)/g,
    (_, index) => `'${categories[Number(index)].slug.replace(/'/g, "''")}'`,
  ));

  console.log(`Cadastro concluido: ${products.length} produtos processados.`);
  for (const row of summary.recordset) {
    console.log(`- ${row.name}: ${row.total}`);
  }
} finally {
  await pool.close();
}
