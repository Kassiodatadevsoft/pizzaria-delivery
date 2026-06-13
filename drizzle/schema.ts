export type UserRole = "user" | "admin";
export type PaymentMethod = "cash" | "card" | "pix";
export type OrderStatus = "received" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";

export type User = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
};

export type InsertUser = {
  openId: string;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  role?: UserRole;
  lastSignedIn?: Date;
};

export type PizzaCategory = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type InsertPizzaCategory = {
  name: string;
  slug: string;
  description?: string | null;
  sortOrder?: number;
  active?: boolean;
};

export type Pizza = {
  id: number;
  categoryId: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  prices: Record<string, number>;
  availableSizes: string[];
  erpCode: string | null;
  featured: boolean;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type InsertPizza = {
  categoryId: number;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  prices: Record<string, number>;
  availableSizes: string[];
  erpCode?: string | null;
  featured?: boolean;
  active?: boolean;
  sortOrder?: number;
};

export type ApiKey = {
  id: number;
  name: string;
  keyHash: string;
  keyPrefix: string;
  active: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type InsertApiKey = {
  name: string;
  keyHash: string;
  keyPrefix: string;
  active?: boolean;
};

export type Order = {
  id: number;
  token: string;
  userId: number | null;
  customerName: string;
  customerPhone: string | null;
  addressStreet: string;
  addressNumber: string;
  addressComplement: string | null;
  addressNeighborhood: string;
  addressCity: string;
  addressState: string;
  addressZip: string | null;
  paymentMethod: PaymentMethod;
  changeFor: string | null;
  subtotal: string;
  deliveryType: string | null;
  deliveryFee: string;
  total: string;
  status: OrderStatus;
  notes: string | null;
  receivedAt: Date;
  preparingAt: Date | null;
  outForDeliveryAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type InsertOrder = Omit<Order, "id" | "createdAt" | "updatedAt" | "preparingAt" | "outForDeliveryAt" | "deliveredAt" | "cancelledAt"> & {
  preparingAt?: Date | null;
  outForDeliveryAt?: Date | null;
  deliveredAt?: Date | null;
  cancelledAt?: Date | null;
};

export type OrderItem = {
  id: number;
  orderId: number;
  pizzaId: number;
  pizzaName: string;
  secondFlavorId: number | null;
  secondFlavorName: string | null;
  size: string;
  sizeLabel: string;
  crust: string | null;
  crustPrice: string | null;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  createdAt: Date;
};

export type InsertOrderItem = Omit<OrderItem, "id" | "createdAt">;
