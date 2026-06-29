import sql from "mssql";
import {
  Addon,
  ApiKey,
  CrustConfig,
  FlavorConfig,
  InsertAddon,
  InsertApiKey,
  InsertOrder,
  InsertOrderItemAddon,
  InsertOrderItem,
  InsertPizza,
  InsertPizzaCategory,
  InsertUser,
  Order,
  OrderItem,
  OrderStatus,
  Pizza,
  PizzaCategory,
  ProductOptionGroup,
  User,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { getSqlServerConnectionConfig } from "./sqlserverConfig";

let poolPromise: Promise<sql.ConnectionPool> | null = null;

const TABLES = {
  users: "[delivery].[users]",
  categories: "[delivery].[pizza_categories]",
  pizzas: "[delivery].[pizzas]",
  apiKeys: "[delivery].[api_keys]",
  orders: "[delivery].[orders]",
  orderItems: "[delivery].[order_items]",
  addons: "[delivery].[adicional]",
  productAddons: "[delivery].[produto_adicional]",
  orderItemAddons: "[delivery].[pedido_item_adicional]",
} as const;

const DEFAULT_FLAVOR_CONFIG: FlavorConfig = {
  enabled: false,
  maxFlavors: 1,
  maxFlavorsBySize: {},
  allowedCategoryIds: [],
  priceMode: "average",
};
const DEFAULT_CRUST_CONFIG: CrustConfig = {
  enabled: false,
  allowedCategoryIds: [],
};
const DEFAULT_PRODUCT_OPTIONS: ProductOptionGroup[] = [];

export async function getDb() {
  return getPool();
}

async function getPool() {
  const connectionConfig = getSqlServerConnectionConfig();
  if (!connectionConfig) {
    return null;
  }

  poolPromise ??= sql.connect(connectionConfig).catch((error) => {
    poolPromise = null;
    console.warn("[Database] Failed to connect to SQL Server:", error);
    throw error;
  });

  try {
    return await poolPromise;
  } catch {
    return null;
  }
}

async function request() {
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  return pool.request();
}

async function optionalRequest() {
  const pool = await getPool();
  return pool?.request() ?? null;
}

function decimalString(value: unknown): string {
  if (value == null) return "0.00";
  return Number(value).toFixed(2);
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (Array.isArray(value) || (value && typeof value === "object")) return value as T;
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapUser(row: any): User {
  return {
    ...row,
    role: row.role ?? "user",
  };
}

function mapCategory(row: any): PizzaCategory {
  return {
    ...row,
    active: Boolean(row.active),
  };
}

function mapPizza(row: any): Pizza {
  return {
    ...row,
    prices: parseJson<Record<string, number>>(row.prices, {}),
    availableSizes: parseJson<string[]>(row.availableSizes, []),
    flavorConfig: parseJson<FlavorConfig>(row.flavorConfig, DEFAULT_FLAVOR_CONFIG),
    crustConfig: parseJson<CrustConfig>(row.crustConfig, DEFAULT_CRUST_CONFIG),
    productOptions: parseJson<ProductOptionGroup[]>(row.productOptions, DEFAULT_PRODUCT_OPTIONS),
    featured: Boolean(row.featured),
    active: Boolean(row.active),
  };
}

function mapApiKey(row: any): ApiKey {
  return {
    ...row,
    active: Boolean(row.active),
  };
}

function mapOrder(row: any): Order {
  return {
    ...row,
    changeFor: row.changeFor == null ? null : decimalString(row.changeFor),
    subtotal: decimalString(row.subtotal),
    deliveryType: row.deliveryType ?? null,
    deliveryFee: decimalString(row.deliveryFee),
    total: decimalString(row.total),
  };
}

function mapAddon(row: any): Addon {
  return {
    id: row.id,
    guidEntidade: row.guidEntidade ?? row.GUIDENTIDADE,
    name: row.name ?? row.nome,
    description: row.description ?? row.descricao ?? null,
    price: decimalString(row.price ?? row.preco),
    active: Boolean(row.active ?? row.ativo),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapOrderItem(row: any): OrderItem & { erpCode?: string | null; secondFlavorErpCode?: string | null } {
  return {
    ...row,
    crustPrice: row.crustPrice == null ? null : decimalString(row.crustPrice),
    unitPrice: decimalString(row.unitPrice),
    totalPrice: decimalString(row.totalPrice),
  };
}

function mapOrderItemAddon(row: any): InsertOrderItemAddon & { id: number; orderItemId: number; createdAt: Date } {
  return {
    id: row.id,
    orderItemId: row.orderItemId,
    addonId: row.addonId ?? null,
    addonName: row.addonName,
    addonPrice: decimalString(row.addonPrice),
    quantity: row.quantity,
    totalPrice: decimalString(row.totalPrice),
    guidEntidade: row.guidEntidade ?? row.GUIDENTIDADE,
    createdAt: row.createdAt,
  };
}

function bindCategory(req: sql.Request, data: InsertPizzaCategory | Partial<InsertPizzaCategory>) {
  if ("name" in data) req.input("name", sql.NVarChar(100), data.name);
  if ("slug" in data) req.input("slug", sql.NVarChar(100), data.slug);
  if ("description" in data) req.input("description", sql.NVarChar(sql.MAX), data.description ?? null);
  if ("sortOrder" in data) req.input("sortOrder", sql.Int, data.sortOrder ?? 0);
  if ("active" in data) req.input("active", sql.Bit, data.active ?? true);
}

function bindPizza(req: sql.Request, data: InsertPizza | Partial<InsertPizza>) {
  if ("categoryId" in data) req.input("categoryId", sql.Int, data.categoryId);
  if ("name" in data) req.input("name", sql.NVarChar(150), data.name);
  if ("description" in data) req.input("description", sql.NVarChar(sql.MAX), data.description ?? null);
  if ("imageUrl" in data) req.input("imageUrl", sql.NVarChar(sql.MAX), data.imageUrl ?? null);
  if ("prices" in data) req.input("prices", sql.NVarChar(sql.MAX), JSON.stringify(data.prices ?? {}));
  if ("availableSizes" in data) req.input("availableSizes", sql.NVarChar(sql.MAX), JSON.stringify(data.availableSizes ?? []));
  if ("flavorConfig" in data) req.input("flavorConfig", sql.NVarChar(sql.MAX), JSON.stringify(data.flavorConfig ?? DEFAULT_FLAVOR_CONFIG));
  if ("crustConfig" in data) req.input("crustConfig", sql.NVarChar(sql.MAX), JSON.stringify(data.crustConfig ?? DEFAULT_CRUST_CONFIG));
  if ("productOptions" in data) req.input("productOptions", sql.NVarChar(sql.MAX), JSON.stringify(data.productOptions ?? DEFAULT_PRODUCT_OPTIONS));
  if ("erpCode" in data) req.input("erpCode", sql.NVarChar(100), data.erpCode ?? null);
  if ("featured" in data) req.input("featured", sql.Bit, data.featured ?? false);
  if ("active" in data) req.input("active", sql.Bit, data.active ?? true);
  if ("sortOrder" in data) req.input("sortOrder", sql.Int, data.sortOrder ?? 0);
}

// Users
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const pool = await getPool();
  if (!pool) return;

  const defaultRole = user.openId === ENV.ownerOpenId ? "admin" : "user";
  const role = user.role ?? null;
  const lastSignedIn = user.lastSignedIn ?? new Date();

  await pool.request()
    .input("openId", sql.NVarChar(64), user.openId)
    .input("name", sql.NVarChar(sql.MAX), user.name ?? null)
    .input("email", sql.NVarChar(320), user.email ?? null)
    .input("loginMethod", sql.NVarChar(64), user.loginMethod ?? null)
    .input("role", sql.NVarChar(20), role)
    .input("defaultRole", sql.NVarChar(20), defaultRole)
    .input("lastSignedIn", sql.DateTime2, lastSignedIn)
    .query(`
      MERGE ${TABLES.users} AS target
      USING (SELECT @openId AS openId) AS source
      ON target.openId = source.openId
      WHEN MATCHED THEN UPDATE SET
        name = COALESCE(@name, target.name),
        email = COALESCE(@email, target.email),
        loginMethod = COALESCE(@loginMethod, target.loginMethod),
        role = COALESCE(@role, target.role, @defaultRole),
        lastSignedIn = @lastSignedIn,
        updatedAt = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (openId, name, email, loginMethod, role, lastSignedIn)
        VALUES (@openId, @name, @email, @loginMethod, COALESCE(@role, @defaultRole), @lastSignedIn);
    `);
}

function bindAddon(req: sql.Request, data: InsertAddon | Partial<InsertAddon>) {
  if ("guidEntidade" in data) req.input("guidEntidade", sql.NVarChar(64), data.guidEntidade ?? ENV.guidEntidade);
  if ("name" in data) req.input("name", sql.NVarChar(150), data.name);
  if ("description" in data) req.input("description", sql.NVarChar(sql.MAX), data.description ?? null);
  if ("price" in data) req.input("price", sql.Decimal(10, 2), data.price == null ? null : Number(data.price));
  if ("active" in data) req.input("active", sql.Bit, data.active ?? true);
}

export async function getUserByOpenId(openId: string) {
  const pool = await getPool();
  if (!pool) return undefined;
  const result = await pool.request()
    .input("openId", sql.NVarChar(64), openId)
    .query(`SELECT TOP 1 * FROM ${TABLES.users} WHERE openId = @openId`);
  return result.recordset[0] ? mapUser(result.recordset[0]) : undefined;
}

// Categories
export async function getCategories(onlyActive = true) {
  const req = await optionalRequest();
  if (!req) return [];
  const result = await req.query(`
    SELECT * FROM ${TABLES.categories}
    ${onlyActive ? "WHERE active = 1" : ""}
    ORDER BY sortOrder ASC
  `);
  return result.recordset.map(mapCategory);
}

export async function getCategoryById(id: number) {
  const req = await optionalRequest();
  if (!req) return undefined;
  const result = await req
    .input("id", sql.Int, id)
    .query(`SELECT TOP 1 * FROM ${TABLES.categories} WHERE id = @id`);
  return result.recordset[0] ? mapCategory(result.recordset[0]) : undefined;
}

export async function getCategoryBySlug(slug: string) {
  const req = await optionalRequest();
  if (!req) return undefined;
  const result = await req
    .input("slug", sql.NVarChar(100), slug)
    .query(`SELECT TOP 1 * FROM ${TABLES.categories} WHERE slug = @slug`);
  return result.recordset[0] ? mapCategory(result.recordset[0]) : undefined;
}

export async function createCategory(data: InsertPizzaCategory) {
  const req = await request();
  bindCategory(req, data);
  return req.query(`
    INSERT INTO ${TABLES.categories} (name, slug, description, sortOrder, active)
    VALUES (@name, @slug, @description, @sortOrder, @active)
  `);
}

export async function updateCategory(id: number, data: Partial<InsertPizzaCategory>) {
  const sets: string[] = [];
  const req = await request();
  req.input("id", sql.Int, id);
  bindCategory(req, data);
  for (const key of ["name", "slug", "description", "sortOrder", "active"] as const) {
    if (key in data) sets.push(`${key} = @${key}`);
  }
  if (sets.length === 0) return { rowsAffected: [0] };
  sets.push("updatedAt = SYSUTCDATETIME()");
  return req.query(`UPDATE ${TABLES.categories} SET ${sets.join(", ")} WHERE id = @id`);
}

export async function deleteCategory(id: number) {
  return (await request()).input("id", sql.Int, id).query(`DELETE FROM ${TABLES.categories} WHERE id = @id`);
}

export async function upsertCategoryBySlug(data: InsertPizzaCategory & { slug: string }) {
  const existing = await getCategoryBySlug(data.slug);
  if (existing) {
    await updateCategory(existing.id, data);
    return { action: "atualizado" as const, id: existing.id };
  }

  const req = await request();
  bindCategory(req, data);
  const result = await req.query(`
    INSERT INTO ${TABLES.categories} (name, slug, description, sortOrder, active)
    OUTPUT INSERTED.id
    VALUES (@name, @slug, @description, @sortOrder, @active)
  `);
  return { action: "criado" as const, id: result.recordset[0].id as number };
}

// Pizzas
export async function getPizzas(onlyActive = true) {
  const req = await optionalRequest();
  if (!req) return [];
  const result = await req.query(`
    SELECT p.* FROM ${TABLES.pizzas} p
    ${onlyActive ? `INNER JOIN ${TABLES.categories} c ON c.id = p.categoryId` : ""}
    ${onlyActive ? "WHERE p.active = 1 AND c.active = 1" : ""}
    ORDER BY p.categoryId ASC, p.sortOrder ASC
  `);
  const pizzas = result.recordset.map(mapPizza);
  const addonsByProduct = await getAddonsForProducts(pizzas.map((pizza) => pizza.id), { onlyActive: onlyActive });
  return pizzas.map((pizza) => ({ ...pizza, addons: addonsByProduct.get(pizza.id) ?? [] }));
}

export async function getFeaturedPizzas() {
  const req = await optionalRequest();
  if (!req) return [];
  const result = await req.query(`
    SELECT TOP 6 p.* FROM ${TABLES.pizzas} p
    INNER JOIN ${TABLES.categories} c ON c.id = p.categoryId
    WHERE p.featured = 1 AND p.active = 1 AND c.active = 1
    ORDER BY p.sortOrder ASC
  `);
  const pizzas = result.recordset.map(mapPizza);
  const addonsByProduct = await getAddonsForProducts(pizzas.map((pizza) => pizza.id), { onlyActive: true });
  return pizzas.map((pizza) => ({ ...pizza, addons: addonsByProduct.get(pizza.id) ?? [] }));
}

export async function getPizzaById(id: number) {
  const req = await optionalRequest();
  if (!req) return undefined;
  const result = await req
    .input("id", sql.Int, id)
    .query(`SELECT TOP 1 * FROM ${TABLES.pizzas} WHERE id = @id`);
  if (!result.recordset[0]) return undefined;
  const pizza = mapPizza(result.recordset[0]);
  const addonsByProduct = await getAddonsForProducts([pizza.id], { onlyActive: true });
  return { ...pizza, addons: addonsByProduct.get(pizza.id) ?? [] };
}

export async function createPizza(data: InsertPizza) {
  await ensurePizzaConfigColumns();
  const req = await request();
  bindPizza(req, { flavorConfig: DEFAULT_FLAVOR_CONFIG, crustConfig: DEFAULT_CRUST_CONFIG, productOptions: DEFAULT_PRODUCT_OPTIONS, ...data });
  return req.query(`
    INSERT INTO ${TABLES.pizzas}
      (categoryId, name, description, imageUrl, prices, availableSizes, flavorConfig, crustConfig, productOptions, erpCode, featured, active, sortOrder)
    OUTPUT INSERTED.id
    VALUES
      (@categoryId, @name, @description, @imageUrl, @prices, @availableSizes, @flavorConfig, @crustConfig, @productOptions, @erpCode, @featured, @active, @sortOrder)
  `);
}

export async function updatePizza(id: number, data: Partial<InsertPizza>) {
  await ensurePizzaConfigColumns();
  const sets: string[] = [];
  const req = await request();
  req.input("id", sql.Int, id);
  bindPizza(req, data);
  for (const key of ["categoryId", "name", "description", "imageUrl", "prices", "availableSizes", "flavorConfig", "crustConfig", "productOptions", "erpCode", "featured", "active", "sortOrder"] as const) {
    if (key in data) sets.push(`${key} = @${key}`);
  }
  if (sets.length === 0) return { rowsAffected: [0] };
  sets.push("updatedAt = SYSUTCDATETIME()");
  return req.query(`UPDATE ${TABLES.pizzas} SET ${sets.join(", ")} WHERE id = @id`);
}

export async function deletePizza(id: number) {
  return (await request()).input("id", sql.Int, id).query(`DELETE FROM ${TABLES.pizzas} WHERE id = @id`);
}

export async function updateProductErpCode(productId: number, erpCode: string | null) {
  return (await request())
    .input("id", sql.Int, productId)
    .input("erpCode", sql.NVarChar(100), erpCode)
    .query(`UPDATE ${TABLES.pizzas} SET erpCode = @erpCode, updatedAt = SYSUTCDATETIME() WHERE id = @id`);
}

// Addons
async function ensureAddonTables(tx?: sql.Transaction) {
  const req = tx ? new sql.Request(tx) : await optionalRequest();
  if (!req) return;
  await req.query(`
    IF OBJECT_ID(N'delivery.adicional', N'U') IS NULL
    BEGIN
      CREATE TABLE ${TABLES.addons} (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_delivery_adicional PRIMARY KEY,
        GUIDENTIDADE NVARCHAR(64) NOT NULL,
        nome NVARCHAR(150) NOT NULL,
        descricao NVARCHAR(MAX) NULL,
        preco DECIMAL(10,2) NOT NULL,
        ativo BIT NOT NULL CONSTRAINT DF_delivery_adicional_ativo DEFAULT 1,
        createdAt DATETIME2 NOT NULL CONSTRAINT DF_delivery_adicional_createdAt DEFAULT SYSUTCDATETIME(),
        updatedAt DATETIME2 NOT NULL CONSTRAINT DF_delivery_adicional_updatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_delivery_adicional_preco CHECK (preco >= 0)
      );
      CREATE INDEX IX_delivery_adicional_guid_ativo_nome ON ${TABLES.addons}(GUIDENTIDADE, ativo, nome);
    END;

    IF OBJECT_ID(N'delivery.produto_adicional', N'U') IS NULL
    BEGIN
      CREATE TABLE ${TABLES.productAddons} (
        productId INT NOT NULL,
        addonId INT NOT NULL,
        GUIDENTIDADE NVARCHAR(64) NOT NULL,
        createdAt DATETIME2 NOT NULL CONSTRAINT DF_delivery_produto_adicional_createdAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_delivery_produto_adicional PRIMARY KEY (productId, addonId, GUIDENTIDADE),
        CONSTRAINT FK_delivery_produto_adicional_produto FOREIGN KEY (productId) REFERENCES ${TABLES.pizzas}(id),
        CONSTRAINT FK_delivery_produto_adicional_adicional FOREIGN KEY (addonId) REFERENCES ${TABLES.addons}(id)
      );
      CREATE INDEX IX_delivery_produto_adicional_guid_product ON ${TABLES.productAddons}(GUIDENTIDADE, productId);
    END;

    IF OBJECT_ID(N'delivery.pedido_item_adicional', N'U') IS NULL
    BEGIN
      CREATE TABLE ${TABLES.orderItemAddons} (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_delivery_pedido_item_adicional PRIMARY KEY,
        orderItemId INT NOT NULL,
        addonId INT NULL,
        addonName NVARCHAR(150) NOT NULL,
        addonPrice DECIMAL(10,2) NOT NULL,
        quantity INT NOT NULL CONSTRAINT DF_delivery_pedido_item_adicional_quantity DEFAULT 1,
        totalPrice DECIMAL(10,2) NOT NULL,
        GUIDENTIDADE NVARCHAR(64) NOT NULL,
        createdAt DATETIME2 NOT NULL CONSTRAINT DF_delivery_pedido_item_adicional_createdAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_delivery_pedido_item_adicional_item FOREIGN KEY (orderItemId) REFERENCES ${TABLES.orderItems}(id),
        CONSTRAINT FK_delivery_pedido_item_adicional_adicional FOREIGN KEY (addonId) REFERENCES ${TABLES.addons}(id),
        CONSTRAINT CK_delivery_pedido_item_adicional_price CHECK (addonPrice >= 0),
        CONSTRAINT CK_delivery_pedido_item_adicional_quantity CHECK (quantity > 0),
        CONSTRAINT CK_delivery_pedido_item_adicional_total CHECK (totalPrice >= 0)
      );
      CREATE INDEX IX_delivery_pedido_item_adicional_item ON ${TABLES.orderItemAddons}(orderItemId);
    END;
  `);
}

export async function listAddons(options: { onlyActive?: boolean; guidEntidade?: string } = {}) {
  await ensureAddonTables();
  const req = await optionalRequest();
  if (!req) return [];
  req.input("guidEntidade", sql.NVarChar(64), options.guidEntidade ?? ENV.guidEntidade);
  const result = await req.query(`
    SELECT id, GUIDENTIDADE AS guidEntidade, nome AS name, descricao AS description, preco AS price,
      ativo AS active, createdAt, updatedAt
    FROM ${TABLES.addons}
    WHERE GUIDENTIDADE = @guidEntidade
      ${options.onlyActive ? "AND ativo = 1" : ""}
    ORDER BY nome ASC
  `);
  return result.recordset.map(mapAddon);
}

export async function getAddonById(id: number, guidEntidade = ENV.guidEntidade) {
  await ensureAddonTables();
  const req = await optionalRequest();
  if (!req) return undefined;
  const result = await req
    .input("id", sql.Int, id)
    .input("guidEntidade", sql.NVarChar(64), guidEntidade)
    .query(`
      SELECT TOP 1 id, GUIDENTIDADE AS guidEntidade, nome AS name, descricao AS description, preco AS price,
        ativo AS active, createdAt, updatedAt
      FROM ${TABLES.addons}
      WHERE id = @id AND GUIDENTIDADE = @guidEntidade
    `);
  return result.recordset[0] ? mapAddon(result.recordset[0]) : undefined;
}

export async function createAddon(data: InsertAddon) {
  await ensureAddonTables();
  const req = await request();
  bindAddon(req, { ...data, guidEntidade: data.guidEntidade ?? ENV.guidEntidade });
  const result = await req.query(`
    INSERT INTO ${TABLES.addons} (GUIDENTIDADE, nome, descricao, preco, ativo)
    OUTPUT INSERTED.id
    VALUES (@guidEntidade, @name, @description, @price, @active)
  `);
  return getAddonById(result.recordset[0].id, data.guidEntidade ?? ENV.guidEntidade);
}

export async function updateAddon(id: number, data: Partial<InsertAddon>, guidEntidade = ENV.guidEntidade) {
  await ensureAddonTables();
  const sets: string[] = [];
  const req = await request();
  req.input("id", sql.Int, id).input("guidEntidade", sql.NVarChar(64), guidEntidade);
  bindAddon(req, data);
  if ("name" in data) sets.push("nome = @name");
  if ("description" in data) sets.push("descricao = @description");
  if ("price" in data) sets.push("preco = @price");
  if ("active" in data) sets.push("ativo = @active");
  if (sets.length === 0) return { rowsAffected: [0] };
  sets.push("updatedAt = SYSUTCDATETIME()");
  return req.query(`UPDATE ${TABLES.addons} SET ${sets.join(", ")} WHERE id = @id AND GUIDENTIDADE = @guidEntidade`);
}

export async function deleteAddon(id: number, guidEntidade = ENV.guidEntidade) {
  await ensureAddonTables();
  return (await request())
    .input("id", sql.Int, id)
    .input("guidEntidade", sql.NVarChar(64), guidEntidade)
    .query(`UPDATE ${TABLES.addons} SET ativo = 0, updatedAt = SYSUTCDATETIME() WHERE id = @id AND GUIDENTIDADE = @guidEntidade`);
}

export async function getProductAddonIds(productId: number, guidEntidade = ENV.guidEntidade) {
  await ensureAddonTables();
  const req = await optionalRequest();
  if (!req) return [];
  const result = await req
    .input("productId", sql.Int, productId)
    .input("guidEntidade", sql.NVarChar(64), guidEntidade)
    .query(`SELECT addonId FROM ${TABLES.productAddons} WHERE productId = @productId AND GUIDENTIDADE = @guidEntidade`);
  return result.recordset.map((row) => Number(row.addonId));
}

export async function setProductAddons(productId: number, addonIds: number[], guidEntidade = ENV.guidEntidade) {
  await ensureAddonTables();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const deleteReq = new sql.Request(tx);
    await deleteReq
      .input("productId", sql.Int, productId)
      .input("guidEntidade", sql.NVarChar(64), guidEntidade)
      .query(`DELETE FROM ${TABLES.productAddons} WHERE productId = @productId AND GUIDENTIDADE = @guidEntidade`);

    const uniqueIds = Array.from(new Set(addonIds)).filter((id) => Number.isInteger(id) && id > 0);
    for (const addonId of uniqueIds) {
      const insertReq = new sql.Request(tx);
      await insertReq
        .input("productId", sql.Int, productId)
        .input("addonId", sql.Int, addonId)
        .input("guidEntidade", sql.NVarChar(64), guidEntidade)
        .query(`
          INSERT INTO ${TABLES.productAddons} (productId, addonId, GUIDENTIDADE)
          SELECT @productId, @addonId, @guidEntidade
          WHERE EXISTS (
            SELECT 1 FROM ${TABLES.addons}
            WHERE id = @addonId AND GUIDENTIDADE = @guidEntidade AND ativo = 1
          )
        `);
    }

    await tx.commit();
    return { success: true };
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

export async function getAddonsForProducts(productIds: number[], options: { onlyActive?: boolean; guidEntidade?: string } = {}) {
  await ensureAddonTables();
  if (productIds.length === 0) return new Map<number, Addon[]>();
  const req = await request();
  req.input("guidEntidade", sql.NVarChar(64), options.guidEntidade ?? ENV.guidEntidade);
  const params = productIds.map((id, index) => {
    const name = `productId${index}`;
    req.input(name, sql.Int, id);
    return `@${name}`;
  });
  const result = await req.query(`
    SELECT pa.productId, a.id, a.GUIDENTIDADE AS guidEntidade, a.nome AS name, a.descricao AS description,
      a.preco AS price, a.ativo AS active, a.createdAt, a.updatedAt
    FROM ${TABLES.productAddons} pa
    INNER JOIN ${TABLES.addons} a ON a.id = pa.addonId AND a.GUIDENTIDADE = pa.GUIDENTIDADE
    WHERE pa.GUIDENTIDADE = @guidEntidade
      AND pa.productId IN (${params.join(", ")})
      ${options.onlyActive ? "AND a.ativo = 1" : ""}
    ORDER BY a.nome ASC
  `);
  return result.recordset.reduce<Map<number, Addon[]>>((acc, row) => {
    const productId = Number(row.productId);
    const list = acc.get(productId) ?? [];
    list.push(mapAddon(row));
    acc.set(productId, list);
    return acc;
  }, new Map());
}

// Orders
function bindOrder(req: sql.Request, data: InsertOrder) {
  req.input("token", sql.NVarChar(64), data.token);
  req.input("userId", sql.Int, data.userId ?? null);
  req.input("customerName", sql.NVarChar(150), data.customerName);
  req.input("customerPhone", sql.NVarChar(20), data.customerPhone ?? null);
  req.input("addressStreet", sql.NVarChar(255), data.addressStreet);
  req.input("addressNumber", sql.NVarChar(20), data.addressNumber);
  req.input("addressComplement", sql.NVarChar(100), data.addressComplement ?? null);
  req.input("addressNeighborhood", sql.NVarChar(100), data.addressNeighborhood);
  req.input("addressCity", sql.NVarChar(100), data.addressCity);
  req.input("addressState", sql.NVarChar(2), data.addressState);
  req.input("addressZip", sql.NVarChar(10), data.addressZip ?? null);
  req.input("paymentMethod", sql.NVarChar(20), data.paymentMethod);
  req.input("changeFor", sql.Decimal(10, 2), data.changeFor == null ? null : Number(data.changeFor));
  req.input("subtotal", sql.Decimal(10, 2), Number(data.subtotal));
  req.input("deliveryType", sql.NVarChar(20), data.deliveryType ?? null);
  req.input("deliveryFee", sql.Decimal(10, 2), Number(data.deliveryFee));
  req.input("total", sql.Decimal(10, 2), Number(data.total));
  req.input("status", sql.NVarChar(30), data.status);
  req.input("notes", sql.NVarChar(sql.MAX), data.notes ?? null);
  req.input("receivedAt", sql.DateTime2, data.receivedAt);
}

async function ensurePizzaConfigColumns() {
  const req = await optionalRequest();
  if (!req) return;
  await req.query(`
    IF COL_LENGTH('delivery.pizzas', 'flavorConfig') IS NULL
      ALTER TABLE ${TABLES.pizzas} ADD flavorConfig NVARCHAR(MAX) NOT NULL
        CONSTRAINT DF_delivery_pizzas_flavorConfig
        DEFAULT N'{"enabled":false,"maxFlavors":1,"maxFlavorsBySize":{},"allowedCategoryIds":[],"priceMode":"average"}';

    IF COL_LENGTH('delivery.pizzas', 'productOptions') IS NULL
      ALTER TABLE ${TABLES.pizzas} ADD productOptions NVARCHAR(MAX) NOT NULL
        CONSTRAINT DF_delivery_pizzas_productOptions
        DEFAULT N'[]';

    IF COL_LENGTH('delivery.pizzas', 'crustConfig') IS NULL
      ALTER TABLE ${TABLES.pizzas} ADD crustConfig NVARCHAR(MAX) NOT NULL
        CONSTRAINT DF_delivery_pizzas_crustConfig
        DEFAULT N'{"enabled":false,"allowedCategoryIds":[]}';
  `);
}

async function ensureOrderFreightColumns(tx?: sql.Transaction) {
  const req = tx ? new sql.Request(tx) : await request();
  await req.query(`
    IF COL_LENGTH('delivery.orders', 'deliveryType') IS NULL
      ALTER TABLE ${TABLES.orders} ADD deliveryType NVARCHAR(20) NULL;
  `);
}

export async function createOrder(orderData: InsertOrder, items: InsertOrderItem[]) {
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await ensureOrderFreightColumns(tx);
    await ensureAddonTables(tx);
    const orderReq = new sql.Request(tx);
    bindOrder(orderReq, orderData);
    const orderResult = await orderReq.query(`
      INSERT INTO ${TABLES.orders}
        (token, userId, customerName, customerPhone, addressStreet, addressNumber, addressComplement,
         addressNeighborhood, addressCity, addressState, addressZip, paymentMethod, changeFor, subtotal,
         deliveryType, deliveryFee, total, status, notes, receivedAt)
      OUTPUT INSERTED.*
      VALUES
        (@token, @userId, @customerName, @customerPhone, @addressStreet, @addressNumber, @addressComplement,
         @addressNeighborhood, @addressCity, @addressState, @addressZip, @paymentMethod, @changeFor, @subtotal,
         @deliveryType, @deliveryFee, @total, @status, @notes, @receivedAt)
    `);
    const inserted = mapOrder(orderResult.recordset[0]);

    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const itemReq = new sql.Request(tx);
      itemReq
        .input("orderId", sql.Int, item.orderId || inserted.id)
        .input("pizzaId", sql.Int, item.pizzaId)
        .input("pizzaName", sql.NVarChar(150), item.pizzaName)
        .input("secondFlavorId", sql.Int, item.secondFlavorId ?? null)
        .input("secondFlavorName", sql.NVarChar(150), item.secondFlavorName ?? null)
        .input("size", sql.NVarChar(32), item.size)
        .input("sizeLabel", sql.NVarChar(64), item.sizeLabel)
        .input("crust", sql.NVarChar(50), item.crust ?? null)
        .input("crustPrice", sql.Decimal(10, 2), item.crustPrice == null ? null : Number(item.crustPrice))
        .input("quantity", sql.Int, item.quantity)
        .input("unitPrice", sql.Decimal(10, 2), Number(item.unitPrice))
        .input("totalPrice", sql.Decimal(10, 2), Number(item.totalPrice));
      const itemResult = await itemReq.query(`
        INSERT INTO ${TABLES.orderItems}
          (orderId, pizzaId, pizzaName, secondFlavorId, secondFlavorName, size, sizeLabel, crust,
           crustPrice, quantity, unitPrice, totalPrice)
        OUTPUT INSERTED.id
        VALUES
          (@orderId, @pizzaId, @pizzaName, @secondFlavorId, @secondFlavorName, @size, @sizeLabel, @crust,
           @crustPrice, @quantity, @unitPrice, @totalPrice)
      `);
      const orderItemId = Number(itemResult.recordset[0].id);

      for (const addon of item.addons ?? []) {
        const addonReq = new sql.Request(tx);
        const addonQuantity = addon.quantity ?? item.quantity;
        addonReq
          .input("orderItemId", sql.Int, orderItemId)
          .input("addonId", sql.Int, addon.addonId ?? null)
          .input("addonName", sql.NVarChar(150), addon.addonName)
          .input("addonPrice", sql.Decimal(10, 2), Number(addon.addonPrice))
          .input("quantity", sql.Int, addonQuantity)
          .input("totalPrice", sql.Decimal(10, 2), Number(addon.totalPrice))
          .input("guidEntidade", sql.NVarChar(64), addon.guidEntidade ?? ENV.guidEntidade);
        await addonReq.query(`
          INSERT INTO ${TABLES.orderItemAddons}
            (orderItemId, addonId, addonName, addonPrice, quantity, totalPrice, GUIDENTIDADE)
          VALUES
            (@orderItemId, @addonId, @addonName, @addonPrice, @quantity, @totalPrice, @guidEntidade)
        `);
      }
    }

    await tx.commit();
    return inserted;
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

export async function getOrderByToken(token: string) {
  const req = await optionalRequest();
  if (!req) return undefined;
  const result = await req
    .input("token", sql.NVarChar(64), token)
    .query(`SELECT TOP 1 * FROM ${TABLES.orders} WHERE token = @token`);
  return result.recordset[0] ? mapOrder(result.recordset[0]) : undefined;
}

export async function getOrderById(id: number) {
  const req = await optionalRequest();
  if (!req) return undefined;
  const result = await req
    .input("id", sql.Int, id)
    .query(`SELECT TOP 1 * FROM ${TABLES.orders} WHERE id = @id`);
  return result.recordset[0] ? mapOrder(result.recordset[0]) : undefined;
}

export async function getOrderItems(orderId: number) {
  const req = await optionalRequest();
  if (!req) return [];
  await ensureAddonTables();
  const result = await req
    .input("orderId", sql.Int, orderId)
    .query(`SELECT * FROM ${TABLES.orderItems} WHERE orderId = @orderId ORDER BY id ASC`);
  const items = result.recordset.map(mapOrderItem);
  const addonsByItem = await getOrderItemAddons(items.map((item) => item.id));
  return items.map((item) => ({ ...item, addons: addonsByItem.get(item.id) ?? [] }));
}

export async function getAllOrders() {
  const req = await optionalRequest();
  if (!req) return [];
  const result = await req.query(`SELECT * FROM ${TABLES.orders} ORDER BY createdAt DESC`);
  return result.recordset.map(mapOrder);
}

export async function getOrdersByUserId(userId: number) {
  const req = await optionalRequest();
  if (!req) return [];
  const result = await req
    .input("userId", sql.Int, userId)
    .query(`SELECT * FROM ${TABLES.orders} WHERE userId = @userId ORDER BY createdAt DESC`);
  return result.recordset.map(mapOrder);
}

export async function updateOrderStatus(id: number, status: OrderStatus) {
  const now = new Date();
  const updates = ["status = @status", "updatedAt = SYSUTCDATETIME()"];
  if (status === "preparing") updates.push("preparingAt = COALESCE(preparingAt, @now)");
  if (status === "out_for_delivery") updates.push("outForDeliveryAt = COALESCE(outForDeliveryAt, @now)");
  if (status === "delivered") updates.push("deliveredAt = COALESCE(deliveredAt, @now)");
  if (status === "cancelled") updates.push("cancelledAt = COALESCE(cancelledAt, @now)");

  return (await request())
    .input("id", sql.Int, id)
    .input("status", sql.NVarChar(30), status)
    .input("now", sql.DateTime2, now)
    .query(`UPDATE ${TABLES.orders} SET ${updates.join(", ")} WHERE id = @id`);
}

// API keys
export async function getApiKeyByHash(keyHash: string) {
  const result = await (await request())
    .input("keyHash", sql.NVarChar(255), keyHash)
    .query(`SELECT TOP 1 * FROM ${TABLES.apiKeys} WHERE keyHash = @keyHash AND active = 1`);
  return result.recordset[0] ? mapApiKey(result.recordset[0]) : undefined;
}

export async function touchApiKey(id: number) {
  return (await request())
    .input("id", sql.Int, id)
    .query(`UPDATE ${TABLES.apiKeys} SET lastUsedAt = SYSUTCDATETIME(), updatedAt = SYSUTCDATETIME() WHERE id = @id`);
}

export async function listApiKeys() {
  const result = await (await request()).query(`
    SELECT id, name, keyPrefix, active, lastUsedAt, createdAt
    FROM ${TABLES.apiKeys}
    ORDER BY createdAt DESC
  `);
  return result.recordset.map(mapApiKey);
}

export async function createApiKey(data: InsertApiKey) {
  return (await request())
    .input("name", sql.NVarChar(100), data.name)
    .input("keyHash", sql.NVarChar(255), data.keyHash)
    .input("keyPrefix", sql.NVarChar(10), data.keyPrefix)
    .input("active", sql.Bit, data.active ?? true)
    .query(`INSERT INTO ${TABLES.apiKeys} (name, keyHash, keyPrefix, active) VALUES (@name, @keyHash, @keyPrefix, @active)`);
}

export async function revokeApiKey(id: number) {
  return (await request())
    .input("id", sql.Int, id)
    .query(`UPDATE ${TABLES.apiKeys} SET active = 0, updatedAt = SYSUTCDATETIME() WHERE id = @id`);
}

// ERP/delivery integration reads
async function getItemsForOrders(orderIds: number[]) {
  if (orderIds.length === 0) return [];
  await ensureAddonTables();
  const req = await request();
  const params = orderIds.map((id, index) => {
    const name = `id${index}`;
    req.input(name, sql.Int, id);
    return `@${name}`;
  });
  const result = await req.query(`
    SELECT
      oi.*,
      p.erpCode,
      sp.erpCode AS secondFlavorErpCode
    FROM ${TABLES.orderItems} oi
    LEFT JOIN ${TABLES.pizzas} p ON p.id = oi.pizzaId
    LEFT JOIN ${TABLES.pizzas} sp ON sp.id = oi.secondFlavorId
    WHERE oi.orderId IN (${params.join(", ")})
    ORDER BY oi.orderId ASC, oi.id ASC
  `);
  const items = result.recordset.map(mapOrderItem);
  const addonsByItem = await getOrderItemAddons(items.map((item) => item.id));
  return items.map((item) => ({ ...item, addons: addonsByItem.get(item.id) ?? [] }));
}

async function getOrderItemAddons(orderItemIds: number[]) {
  if (orderItemIds.length === 0) return new Map<number, ReturnType<typeof mapOrderItemAddon>[]>();
  const req = await request();
  const params = orderItemIds.map((id, index) => {
    const name = `itemId${index}`;
    req.input(name, sql.Int, id);
    return `@${name}`;
  });
  const result = await req.query(`
    SELECT id, orderItemId, addonId, addonName, addonPrice, quantity, totalPrice,
      GUIDENTIDADE AS guidEntidade, createdAt
    FROM ${TABLES.orderItemAddons}
    WHERE orderItemId IN (${params.join(", ")})
    ORDER BY id ASC
  `);
  return result.recordset.reduce<Map<number, ReturnType<typeof mapOrderItemAddon>[]>>((acc, row) => {
    const orderItemId = Number(row.orderItemId);
    const list = acc.get(orderItemId) ?? [];
    list.push(mapOrderItemAddon(row));
    acc.set(orderItemId, list);
    return acc;
  }, new Map());
}

export async function getOrdersWithItems(options: { status?: string; since?: Date; limit?: number } = {}) {
  const req = await request();
  const conditions: string[] = [];
  if (options.status) {
    req.input("status", sql.NVarChar(30), options.status);
    conditions.push("status = @status");
  }
  if (options.since) {
    req.input("since", sql.DateTime2, options.since);
    conditions.push("createdAt >= @since");
  }
  req.input("limit", sql.Int, Math.min(options.limit ?? 50, 200));

  const result = await req.query(`
    SELECT TOP (@limit) *
    FROM ${TABLES.orders}
    ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
    ORDER BY createdAt DESC
  `);
  const orders = result.recordset.map(mapOrder);
  const items = await getItemsForOrders(orders.map((order) => order.id));
  const itemsByOrder = items.reduce<Record<number, typeof items>>((acc, item) => {
    (acc[item.orderId] ??= []).push(item);
    return acc;
  }, {});
  return orders.map((order) => ({ order, items: itemsByOrder[order.id] ?? [] }));
}

export async function getProductsForErp(options: { onlyActive?: boolean; onlyWithErpCode?: boolean } = {}) {
  await ensurePizzaConfigColumns();
  const conditions: string[] = [];
  if (options.onlyActive ?? true) conditions.push("p.active = 1");
  if (options.onlyWithErpCode) conditions.push("p.erpCode IS NOT NULL");

  const result = await (await request()).query(`
    SELECT
      p.id,
      p.name AS nome,
      p.description AS descricao,
      p.categoryId AS categoria_id,
      c.name AS categoria_nome,
      p.erpCode AS erp_code,
      p.prices AS precos,
      p.availableSizes AS tamanhos,
      p.flavorConfig AS configuracao_sabores,
      p.crustConfig AS configuracao_borda,
      p.productOptions AS opcoes_produto,
      p.featured AS destaque,
      p.active AS ativo,
      p.createdAt AS criado_em,
      p.updatedAt AS atualizado_em
    FROM ${TABLES.pizzas} p
    LEFT JOIN ${TABLES.categories} c ON c.id = p.categoryId
    ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
    ORDER BY c.sortOrder ASC, p.sortOrder ASC
  `);

  return result.recordset.map((row) => ({
    ...row,
    precos: parseJson<Record<string, number>>(row.precos, {}),
    tamanhos: parseJson<string[]>(row.tamanhos, []),
    configuracao_sabores: parseJson<FlavorConfig>(row.configuracao_sabores, DEFAULT_FLAVOR_CONFIG),
    configuracao_borda: parseJson<CrustConfig>(row.configuracao_borda, DEFAULT_CRUST_CONFIG),
    opcoes_produto: parseJson<ProductOptionGroup[]>(row.opcoes_produto, DEFAULT_PRODUCT_OPTIONS),
    destaque: Boolean(row.destaque),
    ativo: Boolean(row.ativo),
  }));
}

export async function getPizzaByErpCode(erpCode: string) {
  const result = await (await request())
    .input("erpCode", sql.NVarChar(100), erpCode)
    .query(`SELECT TOP 1 * FROM ${TABLES.pizzas} WHERE erpCode = @erpCode`);
  return result.recordset[0] ? mapPizza(result.recordset[0]) : undefined;
}

export async function upsertPizzaByErpCode(data: InsertPizza & { erpCode: string }) {
  await ensurePizzaConfigColumns();
  const existing = await getPizzaByErpCode(data.erpCode);
  if (existing) {
    await updatePizza(existing.id, data);
    return { action: "atualizado" as const, id: existing.id };
  }
  const req = await request();
  bindPizza(req, { flavorConfig: DEFAULT_FLAVOR_CONFIG, crustConfig: DEFAULT_CRUST_CONFIG, productOptions: DEFAULT_PRODUCT_OPTIONS, ...data });
  const result = await req.query(`
    INSERT INTO ${TABLES.pizzas}
      (categoryId, name, description, imageUrl, prices, availableSizes, flavorConfig, crustConfig, productOptions, erpCode, featured, active, sortOrder)
    OUTPUT INSERTED.id
    VALUES
      (@categoryId, @name, @description, @imageUrl, @prices, @availableSizes, @flavorConfig, @crustConfig, @productOptions, @erpCode, @featured, @active, @sortOrder)
  `);
  return { action: "criado" as const, id: result.recordset[0].id as number };
}

export async function getCategoriesForErp() {
  const result = await (await request()).query(`
    SELECT id, name AS nome, slug, active AS ativo
    FROM ${TABLES.categories}
    ORDER BY sortOrder ASC
  `);
  return result.recordset.map((row) => ({ ...row, ativo: Boolean(row.ativo) }));
}
