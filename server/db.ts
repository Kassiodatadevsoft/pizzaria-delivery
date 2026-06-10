import sql from "mssql";
import {
  ApiKey,
  InsertApiKey,
  InsertOrder,
  InsertOrderItem,
  InsertPizza,
  InsertPizzaCategory,
  InsertUser,
  Order,
  OrderItem,
  OrderStatus,
  Pizza,
  PizzaCategory,
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
} as const;

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
    deliveryFee: decimalString(row.deliveryFee),
    total: decimalString(row.total),
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

// Pizzas
export async function getPizzas(onlyActive = true) {
  const req = await optionalRequest();
  if (!req) return [];
  const result = await req.query(`
    SELECT * FROM ${TABLES.pizzas}
    ${onlyActive ? "WHERE active = 1" : ""}
    ORDER BY categoryId ASC, sortOrder ASC
  `);
  return result.recordset.map(mapPizza);
}

export async function getFeaturedPizzas() {
  const req = await optionalRequest();
  if (!req) return [];
  const result = await req.query(`
    SELECT TOP 6 * FROM ${TABLES.pizzas}
    WHERE featured = 1 AND active = 1
    ORDER BY sortOrder ASC
  `);
  return result.recordset.map(mapPizza);
}

export async function getPizzaById(id: number) {
  const req = await optionalRequest();
  if (!req) return undefined;
  const result = await req
    .input("id", sql.Int, id)
    .query(`SELECT TOP 1 * FROM ${TABLES.pizzas} WHERE id = @id`);
  return result.recordset[0] ? mapPizza(result.recordset[0]) : undefined;
}

export async function createPizza(data: InsertPizza) {
  const req = await request();
  bindPizza(req, data);
  return req.query(`
    INSERT INTO ${TABLES.pizzas}
      (categoryId, name, description, imageUrl, prices, availableSizes, erpCode, featured, active, sortOrder)
    VALUES
      (@categoryId, @name, @description, @imageUrl, @prices, @availableSizes, @erpCode, @featured, @active, @sortOrder)
  `);
}

export async function updatePizza(id: number, data: Partial<InsertPizza>) {
  const sets: string[] = [];
  const req = await request();
  req.input("id", sql.Int, id);
  bindPizza(req, data);
  for (const key of ["categoryId", "name", "description", "imageUrl", "prices", "availableSizes", "erpCode", "featured", "active", "sortOrder"] as const) {
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
  req.input("deliveryFee", sql.Decimal(10, 2), Number(data.deliveryFee));
  req.input("total", sql.Decimal(10, 2), Number(data.total));
  req.input("status", sql.NVarChar(30), data.status);
  req.input("notes", sql.NVarChar(sql.MAX), data.notes ?? null);
  req.input("receivedAt", sql.DateTime2, data.receivedAt);
}

export async function createOrder(orderData: InsertOrder, items: InsertOrderItem[]) {
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const orderReq = new sql.Request(tx);
    bindOrder(orderReq, orderData);
    const orderResult = await orderReq.query(`
      INSERT INTO ${TABLES.orders}
        (token, userId, customerName, customerPhone, addressStreet, addressNumber, addressComplement,
         addressNeighborhood, addressCity, addressState, addressZip, paymentMethod, changeFor, subtotal,
         deliveryFee, total, status, notes, receivedAt)
      OUTPUT INSERTED.*
      VALUES
        (@token, @userId, @customerName, @customerPhone, @addressStreet, @addressNumber, @addressComplement,
         @addressNeighborhood, @addressCity, @addressState, @addressZip, @paymentMethod, @changeFor, @subtotal,
         @deliveryFee, @total, @status, @notes, @receivedAt)
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
      await itemReq.query(`
        INSERT INTO ${TABLES.orderItems}
          (orderId, pizzaId, pizzaName, secondFlavorId, secondFlavorName, size, sizeLabel, crust,
           crustPrice, quantity, unitPrice, totalPrice)
        VALUES
          (@orderId, @pizzaId, @pizzaName, @secondFlavorId, @secondFlavorName, @size, @sizeLabel, @crust,
           @crustPrice, @quantity, @unitPrice, @totalPrice)
      `);
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
  const result = await req
    .input("orderId", sql.Int, orderId)
    .query(`SELECT * FROM ${TABLES.orderItems} WHERE orderId = @orderId ORDER BY id ASC`);
  return result.recordset.map(mapOrderItem);
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
  return result.recordset.map(mapOrderItem);
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
  const existing = await getPizzaByErpCode(data.erpCode);
  if (existing) {
    await updatePizza(existing.id, data);
    return { action: "atualizado" as const, id: existing.id };
  }
  const req = await request();
  bindPizza(req, data);
  const result = await req.query(`
    INSERT INTO ${TABLES.pizzas}
      (categoryId, name, description, imageUrl, prices, availableSizes, erpCode, featured, active, sortOrder)
    OUTPUT INSERTED.id
    VALUES
      (@categoryId, @name, @description, @imageUrl, @prices, @availableSizes, @erpCode, @featured, @active, @sortOrder)
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
