import { Router, Request, Response } from "express";
import { createHash, randomBytes } from "crypto";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  createOrder,
  getApiKeyByHash,
  getCategoryById,
  getCategoriesForErp,
  getOrderById,
  getOrdersWithItems,
  getPizzaByErpCode,
  getPizzaById,
  getProductsForErp,
  touchApiKey,
  updateCategory,
  updateOrderStatus,
  updatePizza,
  upsertCategoryBySlug,
  upsertPizzaByErpCode,
} from "./db";

export const erpRouter = Router();

const flavorConfigSchema = z.object({
  enabled: z.boolean(),
  maxFlavors: z.number().int().min(1).max(20),
  maxFlavorsBySize: z.record(z.string(), z.number().int().min(1).max(20)).optional(),
  allowedCategoryIds: z.array(z.number().int().positive()).optional(),
  priceMode: z.enum(["average", "base"]).optional(),
});

const crustConfigSchema = z.object({
  enabled: z.boolean(),
  allowedCategoryIds: z.array(z.number().int().positive()).optional(),
});

const productOptionChoiceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  priceDelta: z.number().optional(),
});

const productOptionGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  required: z.boolean(),
  selectionMode: z.enum(["single", "multiple"]).optional(),
  sourceCategoryIds: z.array(z.number().int().positive()).optional(),
  choices: z.array(productOptionChoiceSchema).optional().default([]),
});

const productUpdateSchema = z.object({
  erpCode: z.string().max(100).nullable().optional(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  categoryId: z.number().int().positive().optional(),
  prices: z.record(z.string(), z.number()).optional(),
  availableSizes: z.array(z.string().min(1)).optional(),
  flavorConfig: flavorConfigSchema.optional(),
  crustConfig: crustConfigSchema.optional(),
  productOptions: z.array(productOptionGroupSchema).optional(),
  active: z.boolean().optional(),
  featured: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const productMenuConfigSchema = productUpdateSchema.pick({
  flavorConfig: true,
  crustConfig: true,
  productOptions: true,
});

const categorySyncSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

function formatZodError(error: z.ZodError) {
  return error.issues.map((issue) => ({
    campo: issue.path.join(".") || "body",
    mensagem: issue.message,
  }));
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function hasAnyValue(value: Record<string, unknown>) {
  return Object.keys(value).length > 0;
}

async function requireApiKey(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "API Key obrigatoria. Use: Authorization: Bearer pk_live_xxx" });
  }

  const rawKey = authHeader.replace("Bearer ", "").trim();
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const apiKey = await getApiKeyByHash(keyHash);

  if (!apiKey) {
    return res.status(401).json({ error: "API Key invalida ou desativada" });
  }

  await touchApiKey(apiKey.id);
  next();
}

function formatOrder(order: any, items: any[]) {
  return {
    pedido_id: order.id,
    pedido_token: order.token,
    status: order.status,
    forma_pagamento: order.paymentMethod,
    troco_para: order.changeFor ? Number(order.changeFor) : null,
    subtotal: Number(order.subtotal),
    tipo_frete: order.deliveryType || null,
    taxa_entrega: Number(order.deliveryFee),
    total: Number(order.total),
    observacoes: order.notes || null,
    cliente: {
      nome: order.customerName,
      telefone: order.customerPhone || null,
    },
    endereco: {
      rua: order.addressStreet,
      numero: order.addressNumber,
      complemento: order.addressComplement || null,
      bairro: order.addressNeighborhood,
      cidade: order.addressCity,
      estado: order.addressState,
      cep: order.addressZip || null,
    },
    timestamps: {
      pedido_criado: order.createdAt,
      recebido_em: order.receivedAt,
      preparo_iniciado_em: order.preparingAt || null,
      saiu_entrega_em: order.outForDeliveryAt || null,
      entregue_em: order.deliveredAt || null,
      cancelado_em: order.cancelledAt || null,
    },
    itens: items.map((item) => ({
      item_id: item.id,
      produto_id: item.pizzaId,
      produto_erp_code: item.erpCode || null,
      produto_nome: item.pizzaName,
      segundo_sabor_id: item.secondFlavorId || null,
      segundo_sabor_nome: item.secondFlavorName || null,
      segundo_sabor_erp_code: item.secondFlavorErpCode || null,
      tamanho: item.size,
      tamanho_descricao: item.sizeLabel,
      borda: item.crust || null,
      borda_preco: item.crustPrice ? Number(item.crustPrice) : null,
      quantidade: item.quantity,
      preco_unitario: Number(item.unitPrice),
      preco_total_item: Number(item.totalPrice),
    })),
  };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function requiredString(value: unknown, field: string): string {
  const normalized = stringValue(value);
  if (!normalized) throw new Error(`Campo obrigatorio: ${field}`);
  return normalized;
}

function normalizeExternalOrder(body: any) {
  const customer = body.cliente ?? body.customer ?? {};
  const address = body.endereco ?? body.address ?? {};
  const rawItems = body.itens ?? body.items;

  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new Error("Campo obrigatorio: itens");
  }

  const items = rawItems.map((item: any, index: number) => {
    const quantity = numberValue(item.quantidade ?? item.quantity) ?? 1;
    const unitPrice = numberValue(item.preco_unitario ?? item.unitPrice ?? item.unit_price);
    const totalPrice = numberValue(item.preco_total_item ?? item.totalPrice ?? item.total_price)
      ?? (unitPrice !== undefined ? unitPrice * quantity : undefined);
    const secondFlavorId = numberValue(item.segundo_sabor_id ?? item.secondFlavorId);
    const crustPrice = numberValue(item.borda_preco ?? item.crustPrice);

    if (unitPrice === undefined) throw new Error(`Campo obrigatorio: itens[${index}].preco_unitario`);
    if (totalPrice === undefined) throw new Error(`Campo obrigatorio: itens[${index}].preco_total_item`);

    return {
      orderId: 0,
      pizzaId: Math.trunc(numberValue(item.produto_id ?? item.pizzaId ?? item.productId) ?? 0),
      pizzaName: requiredString(item.produto_nome ?? item.pizzaName ?? item.productName ?? item.nome, `itens[${index}].produto_nome`),
      secondFlavorId: secondFlavorId !== undefined ? Math.trunc(secondFlavorId) : null,
      secondFlavorName: stringValue(item.segundo_sabor_nome ?? item.secondFlavorName) ?? null,
      size: requiredString(item.tamanho ?? item.size, `itens[${index}].tamanho`),
      sizeLabel: stringValue(item.tamanho_descricao ?? item.sizeLabel) ?? requiredString(item.tamanho ?? item.size, `itens[${index}].tamanho`),
      crust: stringValue(item.borda ?? item.crust) ?? null,
      crustPrice: crustPrice !== undefined ? String(crustPrice.toFixed(2)) : null,
      quantity: Math.max(1, Math.trunc(quantity)),
      unitPrice: String(unitPrice.toFixed(2)),
      totalPrice: String(totalPrice.toFixed(2)),
    };
  });

  const subtotal = numberValue(body.subtotal) ?? items.reduce((sum, item) => sum + Number(item.totalPrice), 0);
  const deliveryFee = numberValue(body.taxa_entrega ?? body.deliveryFee ?? body.delivery_fee) ?? 0;
  const requestedDeliveryType = stringValue(body.tipo_frete ?? body.deliveryType ?? body.delivery_type);
  const deliveryType = requestedDeliveryType === "KM 100" || requestedDeliveryType === "KM 2"
    ? requestedDeliveryType
    : deliveryFee === 7 ? "KM 100" : "KM 2";
  const total = numberValue(body.total) ?? subtotal + deliveryFee;
  const externalId = stringValue(body.delivery_order_id ?? body.external_id ?? body.externalId);
  const notes = stringValue(body.observacoes ?? body.notes);
  const changeFor = numberValue(body.troco_para ?? body.changeFor);

  return {
    order: {
      token: nanoid(32),
      userId: null,
      customerName: requiredString(customer.nome ?? customer.name ?? body.customerName, "cliente.nome"),
      customerPhone: stringValue(customer.telefone ?? customer.phone ?? body.customerPhone) ?? null,
      addressStreet: requiredString(address.rua ?? address.street ?? body.addressStreet, "endereco.rua"),
      addressNumber: requiredString(address.numero ?? address.number ?? body.addressNumber, "endereco.numero"),
      addressComplement: stringValue(address.complemento ?? address.complement ?? body.addressComplement) ?? null,
      addressNeighborhood: requiredString(address.bairro ?? address.neighborhood ?? body.addressNeighborhood, "endereco.bairro"),
      addressCity: requiredString(address.cidade ?? address.city ?? body.addressCity, "endereco.cidade"),
      addressState: requiredString(address.estado ?? address.state ?? body.addressState, "endereco.estado").slice(0, 2).toUpperCase(),
      addressZip: stringValue(address.cep ?? address.zip ?? body.addressZip) ?? null,
      paymentMethod: (body.forma_pagamento ?? body.paymentMethod ?? "card") as "cash" | "card" | "pix",
      changeFor: changeFor !== undefined ? String(changeFor.toFixed(2)) : null,
      subtotal: String(subtotal.toFixed(2)),
      deliveryType,
      deliveryFee: String(deliveryFee.toFixed(2)),
      total: String(total.toFixed(2)),
      status: "received" as const,
      notes: externalId ? `[Delivery ${externalId}]${notes ? ` ${notes}` : ""}` : notes ?? null,
      receivedAt: new Date(),
    },
    items,
  };
}

erpRouter.post("/orders", requireApiKey, async (req: Request, res: Response) => {
  try {
    const { order, items } = normalizeExternalOrder(req.body);
    const paymentMethods = ["cash", "card", "pix"];
    if (!paymentMethods.includes(order.paymentMethod)) {
      return res.status(400).json({ error: "Forma de pagamento invalida", valores_validos: paymentMethods });
    }

    const insertedOrder = await createOrder(order, items);
    return res.status(201).json({
      success: true,
      pedido_id: insertedOrder.id,
      pedido_token: insertedOrder.token,
      status: insertedOrder.status,
      total: Number(insertedOrder.total),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payload invalido";
    if (message.startsWith("Campo obrigatorio")) return res.status(400).json({ error: message });
    console.error("[ERP] Erro ao criar pedido externo:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
});

erpRouter.get("/orders/new", requireApiKey, async (_req: Request, res: Response) => {
  try {
    const rows = await getOrdersWithItems({ status: "received", limit: 200 });
    return res.json({ total: rows.length, pedidos: rows.map(({ order, items }) => formatOrder(order, items)) });
  } catch (err) {
    console.error("[ERP] Erro ao buscar pedidos novos:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
});

erpRouter.get("/orders", requireApiKey, async (req: Request, res: Response) => {
  try {
    const { status, since, limit = "50" } = req.query as Record<string, string>;
    const sinceDate = since ? new Date(since) : undefined;
    const rows = await getOrdersWithItems({
      status,
      since: sinceDate && !isNaN(sinceDate.getTime()) ? sinceDate : undefined,
      limit: parseInt(limit) || 50,
    });
    return res.json({ total: rows.length, pedidos: rows.map(({ order, items }) => formatOrder(order, items)) });
  } catch (err) {
    console.error("[ERP] Erro ao listar pedidos:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
});

erpRouter.post("/orders/:id/status", requireApiKey, async (req: Request, res: Response) => {
  try {
    const orderId = parseInt(req.params.id);
    const { status } = req.body;
    const validStatuses = ["received", "preparing", "out_for_delivery", "delivered", "cancelled"];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: "Status invalido", valores_validos: validStatuses });
    }

    const order = await getOrderById(orderId);
    if (!order) return res.status(404).json({ error: `Pedido #${orderId} nao encontrado` });

    const now = new Date();
    await updateOrderStatus(orderId, status);
    return res.json({
      success: true,
      pedido_id: orderId,
      status_anterior: order.status,
      status_novo: status,
      atualizado_em: now,
    });
  } catch (err) {
    console.error("[ERP] Erro ao atualizar status:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
});

erpRouter.get("/products", requireApiKey, async (req: Request, res: Response) => {
  try {
    const { only_active = "true", only_with_erp_code = "false" } = req.query as Record<string, string>;
    const produtos = await getProductsForErp({
      onlyActive: only_active === "true",
      onlyWithErpCode: only_with_erp_code === "true",
    });
    return res.json({ total: produtos.length, produtos });
  } catch (err) {
    console.error("[ERP] Erro ao listar produtos:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
});

erpRouter.post("/products/sync", requireApiKey, async (req: Request, res: Response) => {
  try {
    const { erpCode, name, description, imageUrl, categoryId, prices, availableSizes, flavorConfig, crustConfig, productOptions, active = true, featured = false, sortOrder = 0 } = req.body;

    if (!erpCode || !name || !categoryId || !prices || !availableSizes) {
      return res.status(400).json({
        error: "Campos obrigatorios faltando",
        obrigatorios: ["erpCode", "name", "categoryId", "prices", "availableSizes"],
      });
    }

    const productPayload = {
      erpCode,
      name,
      description: description || null,
      categoryId: parseInt(categoryId),
      prices,
      availableSizes,
      imageUrl: imageUrl || null,
      active: Boolean(active),
      featured: Boolean(featured),
      sortOrder: Number.isInteger(sortOrder) ? sortOrder : 0,
      ...(flavorConfig !== undefined ? { flavorConfig } : {}),
      ...(crustConfig !== undefined ? { crustConfig } : {}),
      ...(productOptions !== undefined ? { productOptions } : {}),
    };

    const result = await upsertPizzaByErpCode(productPayload);

    return res.status(result.action === "criado" ? 201 : 200).json({
      success: true,
      acao: result.action,
      produto_id: result.id,
      erp_code: erpCode,
      nome: name,
    });
  } catch (err) {
    console.error("[ERP] Erro ao sincronizar produto:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
});

erpRouter.patch("/products/:id", requireApiKey, async (req: Request, res: Response) => {
  try {
    const productId = parseInt(req.params.id);
    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ error: "produto_id invalido" });
    }

    const parsed = productUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Payload invalido", detalhes: formatZodError(parsed.error) });
    }
    if (!hasAnyValue(parsed.data)) {
      return res.status(400).json({ error: "Informe ao menos um campo para atualizar" });
    }

    const product = await getPizzaById(productId);
    if (!product) return res.status(404).json({ error: `Produto #${productId} nao encontrado` });

    await updatePizza(productId, parsed.data);
    return res.json({ success: true, produto_id: productId, atualizado: Object.keys(parsed.data) });
  } catch (err) {
    console.error("[ERP] Erro ao atualizar produto:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
});

erpRouter.patch("/products/:id/menu-config", requireApiKey, async (req: Request, res: Response) => {
  try {
    const productId = parseInt(req.params.id);
    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ error: "produto_id invalido" });
    }

    const parsed = productMenuConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Payload invalido", detalhes: formatZodError(parsed.error) });
    }
    if (!hasAnyValue(parsed.data)) {
      return res.status(400).json({
        error: "Informe flavorConfig, crustConfig ou productOptions para atualizar",
      });
    }

    const product = await getPizzaById(productId);
    if (!product) return res.status(404).json({ error: `Produto #${productId} nao encontrado` });

    await updatePizza(productId, parsed.data);
    return res.json({
      success: true,
      produto_id: productId,
      configuracoes_atualizadas: Object.keys(parsed.data),
    });
  } catch (err) {
    console.error("[ERP] Erro ao atualizar configuracoes do cardapio:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
});

erpRouter.patch("/products/erp/:erpCode/menu-config", requireApiKey, async (req: Request, res: Response) => {
  try {
    const erpCode = req.params.erpCode?.trim();
    if (!erpCode) return res.status(400).json({ error: "erpCode obrigatorio" });

    const parsed = productMenuConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Payload invalido", detalhes: formatZodError(parsed.error) });
    }
    if (!hasAnyValue(parsed.data)) {
      return res.status(400).json({
        error: "Informe flavorConfig, crustConfig ou productOptions para atualizar",
      });
    }

    const product = await getPizzaByErpCode(erpCode);
    if (!product) return res.status(404).json({ error: `Produto ERP ${erpCode} nao encontrado` });

    await updatePizza(product.id, parsed.data);
    return res.json({
      success: true,
      produto_id: product.id,
      erp_code: erpCode,
      configuracoes_atualizadas: Object.keys(parsed.data),
    });
  } catch (err) {
    console.error("[ERP] Erro ao atualizar configuracoes do cardapio por ERP:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
});

erpRouter.get("/categories", requireApiKey, async (_req: Request, res: Response) => {
  try {
    const categorias = await getCategoriesForErp();
    return res.json({ total: categorias.length, categorias });
  } catch (err) {
    console.error("[ERP] Erro ao listar categorias:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
});

erpRouter.post("/categories/sync", requireApiKey, async (req: Request, res: Response) => {
  try {
    const parsed = categorySyncSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Payload invalido", detalhes: formatZodError(parsed.error) });
    }

    const { id, name, description, sortOrder, active } = parsed.data;
    const slug = parsed.data.slug ?? slugify(name);
    if (!slug) return res.status(400).json({ error: "slug invalido" });

    const payload = {
      name,
      slug,
      description: description ?? null,
      sortOrder: sortOrder ?? 0,
      active: active ?? true,
    };

    if (id) {
      const category = await getCategoryById(id);
      if (!category) return res.status(404).json({ error: `Categoria #${id} nao encontrada` });
      await updateCategory(id, payload);
      return res.json({ success: true, acao: "atualizado", categoria_id: id, slug });
    }

    const result = await upsertCategoryBySlug(payload);
    return res.status(result.action === "criado" ? 201 : 200).json({
      success: true,
      acao: result.action,
      categoria_id: result.id,
      slug,
    });
  } catch (err) {
    console.error("[ERP] Erro ao sincronizar categoria:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
});

export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const raw = "pk_live_" + randomBytes(24).toString("hex");
  const hash = createHash("sha256").update(raw).digest("hex");
  const prefix = raw.substring(0, 10);
  return { raw, hash, prefix };
}
