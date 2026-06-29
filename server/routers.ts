import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { notifyOwner } from "./_core/notification";
import {
  createAddon,
  createApiKey,
  createCategory,
  createOrder,
  createPizza,
  deleteAddon,
  deleteCategory,
  deletePizza,
  getAllOrders,
  getCategories,
  getFeaturedPizzas,
  getOrderById,
  getOrderByToken,
  getOrderItems,
  getOrdersByUserId,
  getPizzaById,
  getPizzas,
  getProductAddonIds,
  listAddons,
  listApiKeys,
  revokeApiKey,
  setProductAddons,
  updateAddon,
  updateCategory,
  updateOrderStatus,
  updatePizza,
  updateProductErpCode,
  upsertUser,
} from "./db";
import { generateApiKey } from "./erpRouter";

const CRUST_LABELS: Record<string, string> = {
  mussarela: "Mussarela",
  cheddar: "Cheddar",
  catupiry: "Catupiry",
  "4queijos": "4 Queijos",
  chocolate: "Chocolate",
};

function enrichItems(items: Awaited<ReturnType<typeof getOrderItems>>) {
  return items.map((item) => ({
    ...item,
    crustLabel: item.crust ? (CRUST_LABELS[item.crust] ?? item.crust) : null,
  }));
}

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito ao administrador." });
  }
  return next({ ctx });
});

const paymentEnum = z.enum(["cash", "card", "pix"]);
const statusEnum = z.enum(["received", "preparing", "out_for_delivery", "delivered", "cancelled"]);
const deliveryTypeEnum = z.enum(["KM 2", "KM 100"]);
const DELIVERY_FEES: Record<z.infer<typeof deliveryTypeEnum>, number> = {
  "KM 2": 5,
  "KM 100": 7,
};

const flavorConfigSchema = z.object({
  enabled: z.boolean().default(false),
  maxFlavors: z.number().int().min(1).max(20).default(1),
  maxFlavorsBySize: z.record(z.string(), z.number().int().min(1).max(20)).optional().default({}),
  allowedCategoryIds: z.array(z.number().int().positive()).optional().default([]),
  priceMode: z.enum(["average", "base"]).optional().default("average"),
});

const crustConfigSchema = z.object({
  enabled: z.boolean().default(false),
  allowedCategoryIds: z.array(z.number().int().positive()).optional().default([]),
});

const productOptionChoiceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  priceDelta: z.number().optional().default(0),
});

const productOptionGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  required: z.boolean().default(true),
  selectionMode: z.enum(["single", "multiple"]).optional().default("single"),
  sourceCategoryIds: z.array(z.number().int().positive()).optional().default([]),
  choices: z.array(productOptionChoiceSchema).optional().default([]),
}).refine((group) => group.choices.length > 0 || group.sourceCategoryIds.length > 0, {
  message: "Informe escolhas ou categorias para a opcao.",
});

const addonSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  price: z.number().min(0),
  active: z.boolean().optional().default(true),
});

const selectedAddonSchema = z.object({
  addonId: z.number().int().positive().nullable().optional(),
  addonName: z.string().min(1),
  addonPrice: z.number().min(0),
});

const orderItemSchema = z.object({
  pizzaId: z.number().int().positive(),
  pizzaName: z.string().min(1),
  secondFlavorId: z.number().int().positive().optional(),
  secondFlavorName: z.string().optional(),
  size: z.string().min(1),
  sizeLabel: z.string().min(1),
  crust: z.string().optional(),
  crustPrice: z.number().min(0).optional(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  totalPrice: z.number().positive(),
  addons: z.array(selectedAddonSchema).optional().default([]),
});

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    login: publicProcedure
      .input(z.object({ username: z.string().min(1), password: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        if (input.username !== ENV.adminUsername || input.password !== ENV.adminPassword) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Usuario ou senha invalidos." });
        }

        const now = new Date();
        await upsertUser({
          openId: "admin-local",
          name: "Admin Prime",
          role: "admin",
          loginMethod: "password",
          lastSignedIn: now,
        });

        const sessionToken = await sdk.createSessionToken("admin-local", {
          name: "Admin Prime",
          expiresInMs: ONE_YEAR_MS,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        return { success: true } as const;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  categories: router({
    list: publicProcedure
      .input(z.object({ onlyActive: z.boolean().optional().default(true) }))
      .query(({ input }) => getCategories(input.onlyActive)),

    create: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        slug: z.string().min(1),
        description: z.string().optional(),
        sortOrder: z.number().int().optional().default(0),
        active: z.boolean().optional().default(true),
      }))
      .mutation(({ input }) => createCategory(input)),

    update: adminProcedure
      .input(z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).optional(),
        slug: z.string().min(1).optional(),
        description: z.string().optional(),
        sortOrder: z.number().int().optional(),
        active: z.boolean().optional(),
      }))
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updateCategory(id, data);
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => deleteCategory(input.id)),
  }),

  pizzas: router({
    list: publicProcedure
      .input(z.object({ onlyActive: z.boolean().optional().default(true) }))
      .query(({ input }) => getPizzas(input.onlyActive)),

    featured: publicProcedure.query(() => getFeaturedPizzas()),

    byId: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(({ input }) => getPizzaById(input.id)),

    create: adminProcedure
      .input(z.object({
        categoryId: z.number().int().positive(),
        name: z.string().min(1),
        description: z.string().optional(),
        imageUrl: z.string().optional(),
        erpCode: z.string().max(100).optional(),
        prices: z.record(z.string(), z.number()),
        availableSizes: z.array(z.string().min(1)),
        flavorConfig: flavorConfigSchema.optional(),
        crustConfig: crustConfigSchema.optional(),
        productOptions: z.array(productOptionGroupSchema).optional(),
        addonIds: z.array(z.number().int().positive()).optional().default([]),
        featured: z.boolean().optional().default(false),
        active: z.boolean().optional().default(true),
        sortOrder: z.number().int().optional().default(0),
      }))
      .mutation(async ({ input }) => {
        const { addonIds, ...pizzaInput } = input;
        const result = await createPizza({
          ...pizzaInput,
          prices: pizzaInput.prices as Record<string, number>,
          availableSizes: pizzaInput.availableSizes as string[],
          flavorConfig: pizzaInput.flavorConfig,
          crustConfig: pizzaInput.crustConfig,
          productOptions: pizzaInput.productOptions,
        });
        const productId = Number(result.recordset?.[0]?.id);
        if (productId && addonIds.length > 0) {
          await setProductAddons(productId, addonIds);
        }
        return { success: true, id: productId };
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number().int().positive(),
        categoryId: z.number().int().positive().optional(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        imageUrl: z.string().optional(),
        erpCode: z.string().max(100).nullable().optional(),
        prices: z.record(z.string(), z.number()).optional(),
        availableSizes: z.array(z.string().min(1)).optional(),
        flavorConfig: flavorConfigSchema.optional(),
        crustConfig: crustConfigSchema.optional(),
        productOptions: z.array(productOptionGroupSchema).optional(),
        addonIds: z.array(z.number().int().positive()).optional(),
        featured: z.boolean().optional(),
        active: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, addonIds, ...data } = input;
        await updatePizza(id, data as Parameters<typeof updatePizza>[1]);
        if (addonIds) await setProductAddons(id, addonIds);
        return { success: true };
      }),

    addonIds: adminProcedure
      .input(z.object({ productId: z.number().int().positive() }))
      .query(({ input }) => getProductAddonIds(input.productId)),

    setAddons: adminProcedure
      .input(z.object({
        productId: z.number().int().positive(),
        addonIds: z.array(z.number().int().positive()).default([]),
      }))
      .mutation(async ({ input }) => {
        await setProductAddons(input.productId, input.addonIds);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => deletePizza(input.id)),
  }),

  addons: router({
    list: adminProcedure
      .input(z.object({ onlyActive: z.boolean().optional().default(false) }))
      .query(({ input }) => listAddons({ onlyActive: input.onlyActive })),

    create: adminProcedure
      .input(addonSchema)
      .mutation(({ input }) => createAddon({
        name: input.name,
        description: input.description ?? null,
        price: input.price.toFixed(2),
        active: input.active,
      })),

    update: adminProcedure
      .input(addonSchema.partial().extend({ id: z.number().int().positive() }))
      .mutation(({ input }) => {
        const { id, price, ...data } = input;
        return updateAddon(id, {
          ...data,
          ...(price != null ? { price: price.toFixed(2) } : {}),
        });
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => deleteAddon(input.id)),
  }),

  orders: router({
    create: publicProcedure
      .input(z.object({
        customerName: z.string().min(1),
        customerPhone: z.string().optional(),
        addressStreet: z.string().min(1),
        addressNumber: z.string().min(1),
        addressComplement: z.string().optional(),
        addressNeighborhood: z.string().min(1),
        addressCity: z.string().min(1),
        addressState: z.string().length(2),
        addressZip: z.string().optional(),
        paymentMethod: paymentEnum,
        changeFor: z.number().optional(),
        notes: z.string().optional(),
        items: z.array(orderItemSchema).min(1),
        deliveryType: deliveryTypeEnum,
      }))
      .mutation(async ({ input, ctx }) => {
        const token = nanoid(32);
        const subtotal = input.items.reduce((sum, item) => sum + item.totalPrice, 0);
        const deliveryFee = DELIVERY_FEES[input.deliveryType];
        const total = subtotal + deliveryFee;

        const orderData = {
          token,
          userId: ctx.user?.id ?? null,
          customerName: input.customerName,
          customerPhone: input.customerPhone ?? null,
          addressStreet: input.addressStreet,
          addressNumber: input.addressNumber,
          addressComplement: input.addressComplement ?? null,
          addressNeighborhood: input.addressNeighborhood,
          addressCity: input.addressCity,
          addressState: input.addressState,
          addressZip: input.addressZip ?? null,
          paymentMethod: input.paymentMethod,
          changeFor: input.changeFor ? String(input.changeFor) : null,
          subtotal: String(subtotal.toFixed(2)),
          deliveryType: input.deliveryType,
          deliveryFee: String(deliveryFee.toFixed(2)),
          total: String(total.toFixed(2)),
          notes: input.notes ?? null,
          status: "received" as const,
          receivedAt: new Date(),
        };

        const itemsData = input.items.map((item) => ({
          orderId: 0,
          pizzaId: item.pizzaId,
          pizzaName: item.pizzaName,
          secondFlavorId: item.secondFlavorId ?? null,
          secondFlavorName: item.secondFlavorName ?? null,
          size: item.size,
          sizeLabel: item.sizeLabel,
          crust: item.crust ?? null,
          crustPrice: item.crustPrice != null ? String(item.crustPrice.toFixed(2)) : null,
          quantity: item.quantity,
          unitPrice: String(item.unitPrice.toFixed(2)),
          totalPrice: String(item.totalPrice.toFixed(2)),
          addons: item.addons.map((addon) => ({
            addonId: addon.addonId ?? null,
            addonName: addon.addonName,
            addonPrice: addon.addonPrice.toFixed(2),
            quantity: item.quantity,
            totalPrice: (addon.addonPrice * item.quantity).toFixed(2),
            guidEntidade: ENV.guidEntidade,
          })),
        }));

        const insertedOrder = await createOrder(orderData, itemsData);

        const itemsSummary = input.items
          .map((i) => {
            const crustLabel = i.crust ? (CRUST_LABELS[i.crust] ?? i.crust) : null;
            const crustLine = crustLabel ? ` + Borda ${crustLabel}` : "";
            const addonsLine = i.addons.length
              ? `\n${i.addons.map((addon) => `  + ${addon.addonName} - R$ ${addon.addonPrice.toFixed(2)}`).join("\n")}`
              : "";
            return `- ${i.quantity}x ${i.pizzaName} (${i.sizeLabel})${crustLine} - R$ ${i.totalPrice.toFixed(2)}${addonsLine}`;
          })
          .join("\n");

        const paymentLabels: Record<string, string> = { cash: "Dinheiro", card: "Cartao", pix: "PIX" };

        await notifyOwner({
          title: `Novo pedido recebido - ${input.customerName}`,
          content: `**Cliente:** ${input.customerName}\n**Telefone:** ${input.customerPhone ?? "nao informado"}\n\n**Endereco de entrega:**\n${input.addressStreet}, ${input.addressNumber}${input.addressComplement ? ` (${input.addressComplement})` : ""}\n${input.addressNeighborhood} - ${input.addressCity}/${input.addressState}\n\n**Itens do pedido:**\n${itemsSummary}\n\n**Subtotal:** R$ ${subtotal.toFixed(2)}\n**Taxa de entrega:** R$ ${deliveryFee.toFixed(2)}\n**Total:** R$ ${total.toFixed(2)}\n\n**Pagamento:** ${paymentLabels[input.paymentMethod] ?? input.paymentMethod}${input.changeFor ? ` (troco para R$ ${input.changeFor.toFixed(2)})` : ""}\n\n**Token de acompanhamento:** ${token}`,
        });

        return { token, total, orderId: insertedOrder.id };
      }),

    byToken: publicProcedure
      .input(z.object({ token: z.string().min(1) }))
      .query(async ({ input }) => {
        const order = await getOrderByToken(input.token);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado." });
        const items = enrichItems(await getOrderItems(order.id));
        return { ...order, items };
      }),

    myOrders: protectedProcedure.query(({ ctx }) => getOrdersByUserId(ctx.user.id)),
    all: adminProcedure.query(() => getAllOrders()),

    updateStatus: adminProcedure
      .input(z.object({ id: z.number().int().positive(), status: statusEnum }))
      .mutation(({ input }) => updateOrderStatus(input.id, input.status)),

    getWithItems: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const order = await getOrderById(input.id);
        if (!order) throw new TRPCError({ code: "NOT_FOUND" });
        const items = enrichItems(await getOrderItems(order.id));
        return { ...order, items };
      }),
  }),

  apiKeys: router({
    list: adminProcedure.query(() => listApiKeys()),

    create: adminProcedure
      .input(z.object({ name: z.string().min(1).max(100) }))
      .mutation(async ({ input }) => {
        const { raw, hash, prefix } = generateApiKey();
        await createApiKey({
          name: input.name,
          keyHash: hash,
          keyPrefix: prefix,
          active: true,
        });
        return { raw, prefix, name: input.name };
      }),

    revoke: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await revokeApiKey(input.id);
        return { success: true };
      }),
  }),

  erp: router({
    updateProductErpCode: adminProcedure
      .input(z.object({
        productId: z.number().int().positive(),
        erpCode: z.string().max(100).nullable(),
      }))
      .mutation(async ({ input }) => {
        await updateProductErpCode(input.productId, input.erpCode);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
