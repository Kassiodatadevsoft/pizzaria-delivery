import "dotenv/config";
import fs from "node:fs/promises";
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

function repairText(value) {
  let text = value;
  for (let i = 0; i < 3 && /Ã|Â/.test(text); i++) {
    text = Buffer.from(text, "latin1").toString("utf8");
  }
  return text.normalize("NFC");
}

function titleCase(value) {
  const keepUpper = new Set(["H2O", "LS"]);
  return value
    .toLowerCase()
    .split(" ")
    .map((part) => {
      const upper = part.toUpperCase();
      if (keepUpper.has(upper)) return upper;
      if (/^\d+[a-z]$/i.test(part)) return upper;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ")
    .replace(/\bCom\b/g, "com")
    .replace(/\bAo\b/g, "ao")
    .replace(/\bA\b/g, "a")
    .replace(/\bDe\b/g, "de")
    .replace(/\bDa\b/g, "da")
    .replace(/\bDo\b/g, "do");
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function money(value) {
  return Number(String(value).replace(",", "."));
}

const connectionConfig = getSqlServerConnectionConfig();
if (!connectionConfig) {
  console.error("SQLSERVER_URL ou DATABASE_URL nao configurada.");
  process.exit(1);
}

const CATEGORY_META = new Map([
  ["pizzas-tradicionais", { name: "Pizzas Tradicionais", description: "Pizzas salgadas tradicionais", sortOrder: 1 }],
  ["pizzas-doces", { name: "Pizzas Doces", description: "Pizzas doces", sortOrder: 2 }],
  ["porcoes", { name: "Porções", description: "Serve 2 pessoas", sortOrder: 3 }],
  ["pratos-executivos", { name: "Pratos Executivos", description: "Pratos individuais", sortOrder: 4 }],
  ["petiscos", { name: "Petiscos", description: "Petiscos e acompanhamentos", sortOrder: 5 }],
  ["cremes-especiais", { name: "Cremes Especiais", description: "Cremes especiais de frutas", sortOrder: 6 }],
  ["aperitivos", { name: "Aperitivos", description: "Aperitivos refrescantes", sortOrder: 7 }],
  ["sucos", { name: "Sucos", description: "Sucos naturais", sortOrder: 8 }],
  ["refrigerantes", { name: "Refrigerantes", description: "Refrigerantes", sortOrder: 9 }],
  ["aguas", { name: "Águas", description: "Águas e H2O", sortOrder: 10 }],
  ["hamburgueres", { name: "Hambúrgueres", description: "Hambúrgueres artesanais", sortOrder: 11 }],
  ["barcas", { name: "Barcas", description: "Combos barca", sortOrder: 12 }],
]);

const HEADING_TO_SLUG = [
  [/PIZZAS TRADICIONAIS/, "pizzas-tradicionais"],
  [/PIZZAS DOCES/, "pizzas-doces"],
  [/PORÇÕES/, "porcoes"],
  [/PRATOS EXECUTIVOS/, "pratos-executivos"],
  [/PETISCOS/, "petiscos"],
  [/CREMES ESPECIAIS/, "cremes-especiais"],
  [/APERITIVOS/, "aperitivos"],
  [/SUCOS/, "sucos"],
  [/REFRIGERANTES/, "refrigerantes"],
  [/ÁGUAS/, "aguas"],
  [/HAMBÚRGUERES/, "hamburgueres"],
  [/BARCAS/, "barcas"],
  [/ENERGÉTICOS|DRINKS|CERVEJAS|CHOPP/, "skip"],
];

const PIZZA_PRICES = { brotinho: 20, pequena: 58, media: 68, grande: 78, trem: 145, bitrem: 200 };
const PIZZA_SIZES = ["brotinho", "pequena", "media", "grande", "trem", "bitrem"];

function parseCardapio(markdown) {
  const products = [];
  let categorySlug = "";
  let sortByCategory = {};

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("## ")) {
      const upper = line.toUpperCase();
      const found = HEADING_TO_SLUG.find(([pattern]) => pattern.test(upper));
      categorySlug = found?.[1] ?? "";
      continue;
    }

    if (!categorySlug || categorySlug === "skip" || line.startsWith("###")) continue;

    if (categorySlug === "sucos" && line.startsWith("- ")) {
      const flavors = line.replace(/^-\s*/, "").split(",").map((flavor) => flavor.trim()).filter(Boolean);
      for (const flavor of flavors) {
        const sortOrder = (sortByCategory[categorySlug] = (sortByCategory[categorySlug] ?? 0) + 1);
        products.push({
          categorySlug,
          name: `Suco de ${titleCase(flavor)}`,
          description: "Jarra ou copo",
          prices: { jarra: 25, copo: 10 },
          availableSizes: ["jarra", "copo"],
          featured: false,
          sortOrder,
        });
      }
      continue;
    }

    const numbered = line.match(/^\d+\.\s+(.+?)\s+-\s+(.+)$/);
    if (numbered && categorySlug.startsWith("pizzas-")) {
      const sortOrder = (sortByCategory[categorySlug] = (sortByCategory[categorySlug] ?? 0) + 1);
      const name = titleCase(numbered[1]);
      products.push({
        categorySlug,
        name,
        description: numbered[2],
        prices: PIZZA_PRICES,
        availableSizes: PIZZA_SIZES,
        featured: ["Calabresa", "Mussarela", "Frango com Catupiry", "Prime", "4 Queijos", "Brigadeiro"].includes(name),
        sortOrder,
      });
      continue;
    }

    const priced = line.match(/^-\s+(.+?)\s+R\$(\d+(?:[,.]\d{1,2})?)\s*(?:-\s*(.*))?$/);
    if (priced) {
      const sortOrder = (sortByCategory[categorySlug] = (sortByCategory[categorySlug] ?? 0) + 1);
      products.push({
        categorySlug,
        name: titleCase(priced[1]),
        description: priced[3] ?? "",
        prices: { unico: money(priced[2]) },
        availableSizes: ["unico"],
        featured: false,
        sortOrder,
      });
    }
  }

  return products;
}

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
    .input("erpCode", sql.NVarChar(100), `CARD-${slugify(product.categorySlug)}-${slugify(product.name)}`.slice(0, 100))
    .query(`
      MERGE delivery.pizzas AS target
      USING (SELECT @categoryId AS categoryId, @name AS name) AS source
      ON target.categoryId = source.categoryId AND target.name = source.name
      WHEN MATCHED THEN UPDATE SET
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

const rawMarkdown = await fs.readFile("cardapio_completo.md", "utf8");
const markdown = repairText(rawMarkdown);
const products = parseCardapio(markdown);

if (products.length === 0) {
  console.error("Nenhum produto encontrado em cardapio_completo.md.");
  process.exit(1);
}

const pool = await sql.connect(connectionConfig);

try {
  console.log(`Cardapio lido: ${products.length} produtos encontrados.`);

  const categoryIds = new Map();
  for (const [slug, meta] of CATEGORY_META) {
    if (!products.some((product) => product.categorySlug === slug)) continue;
    categoryIds.set(slug, await upsertCategory(pool, { slug, ...meta }));
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
    WHERE c.active = 1
    GROUP BY c.name, c.sortOrder
    ORDER BY c.sortOrder;
  `);

  console.log("Cadastro concluido:");
  for (const row of summary.recordset) {
    console.log(`- ${row.name}: ${row.total}`);
  }
} finally {
  await pool.close();
}
