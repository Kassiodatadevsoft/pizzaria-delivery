IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'delivery')
BEGIN
  EXEC(N'CREATE SCHEMA delivery');
END;
GO

IF OBJECT_ID(N'delivery.users', N'U') IS NULL
BEGIN
  CREATE TABLE delivery.users (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_delivery_users PRIMARY KEY,
    openId NVARCHAR(64) NOT NULL CONSTRAINT UQ_delivery_users_openId UNIQUE,
    name NVARCHAR(MAX) NULL,
    email NVARCHAR(320) NULL,
    loginMethod NVARCHAR(64) NULL,
    role NVARCHAR(20) NOT NULL CONSTRAINT DF_delivery_users_role DEFAULT N'user',
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_delivery_users_createdAt DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2 NOT NULL CONSTRAINT DF_delivery_users_updatedAt DEFAULT SYSUTCDATETIME(),
    lastSignedIn DATETIME2 NOT NULL CONSTRAINT DF_delivery_users_lastSignedIn DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_delivery_users_role CHECK (role IN (N'user', N'admin'))
  );
END;
GO

IF OBJECT_ID(N'delivery.pizza_categories', N'U') IS NULL
BEGIN
  CREATE TABLE delivery.pizza_categories (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_delivery_pizza_categories PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    slug NVARCHAR(100) NOT NULL CONSTRAINT UQ_delivery_pizza_categories_slug UNIQUE,
    description NVARCHAR(MAX) NULL,
    sortOrder INT NOT NULL CONSTRAINT DF_delivery_pizza_categories_sortOrder DEFAULT 0,
    active BIT NOT NULL CONSTRAINT DF_delivery_pizza_categories_active DEFAULT 1,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_delivery_pizza_categories_createdAt DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2 NOT NULL CONSTRAINT DF_delivery_pizza_categories_updatedAt DEFAULT SYSUTCDATETIME()
  );
END;
GO

IF OBJECT_ID(N'delivery.pizzas', N'U') IS NULL
BEGIN
  CREATE TABLE delivery.pizzas (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_delivery_pizzas PRIMARY KEY,
    categoryId INT NOT NULL,
    name NVARCHAR(150) NOT NULL,
    description NVARCHAR(MAX) NULL,
    imageUrl NVARCHAR(MAX) NULL,
    prices NVARCHAR(MAX) NOT NULL,
    availableSizes NVARCHAR(MAX) NOT NULL,
    flavorConfig NVARCHAR(MAX) NOT NULL CONSTRAINT DF_delivery_pizzas_flavorConfig DEFAULT N'{"enabled":false,"maxFlavors":1,"maxFlavorsBySize":{},"allowedCategoryIds":[],"priceMode":"average"}',
    crustConfig NVARCHAR(MAX) NOT NULL CONSTRAINT DF_delivery_pizzas_crustConfig DEFAULT N'{"enabled":false,"allowedCategoryIds":[]}',
    productOptions NVARCHAR(MAX) NOT NULL CONSTRAINT DF_delivery_pizzas_productOptions DEFAULT N'[]',
    erpCode NVARCHAR(100) NULL,
    featured BIT NOT NULL CONSTRAINT DF_delivery_pizzas_featured DEFAULT 0,
    active BIT NOT NULL CONSTRAINT DF_delivery_pizzas_active DEFAULT 1,
    sortOrder INT NOT NULL CONSTRAINT DF_delivery_pizzas_sortOrder DEFAULT 0,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_delivery_pizzas_createdAt DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2 NOT NULL CONSTRAINT DF_delivery_pizzas_updatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_delivery_pizzas_category FOREIGN KEY (categoryId) REFERENCES delivery.pizza_categories(id),
    CONSTRAINT CK_delivery_pizzas_prices_json CHECK (ISJSON(prices) = 1),
    CONSTRAINT CK_delivery_pizzas_availableSizes_json CHECK (ISJSON(availableSizes) = 1),
    CONSTRAINT CK_delivery_pizzas_flavorConfig_json CHECK (ISJSON(flavorConfig) = 1),
    CONSTRAINT CK_delivery_pizzas_crustConfig_json CHECK (ISJSON(crustConfig) = 1),
    CONSTRAINT CK_delivery_pizzas_productOptions_json CHECK (ISJSON(productOptions) = 1)
  );

  CREATE UNIQUE INDEX UX_delivery_pizzas_erpCode
    ON delivery.pizzas(erpCode)
    WHERE erpCode IS NOT NULL;
END;
GO

IF COL_LENGTH('delivery.pizzas', 'flavorConfig') IS NULL
BEGIN
  ALTER TABLE delivery.pizzas
    ADD flavorConfig NVARCHAR(MAX) NOT NULL
      CONSTRAINT DF_delivery_pizzas_flavorConfig
      DEFAULT N'{"enabled":false,"maxFlavors":1,"maxFlavorsBySize":{},"allowedCategoryIds":[],"priceMode":"average"}';
END;
GO

IF COL_LENGTH('delivery.pizzas', 'productOptions') IS NULL
BEGIN
  ALTER TABLE delivery.pizzas
    ADD productOptions NVARCHAR(MAX) NOT NULL
      CONSTRAINT DF_delivery_pizzas_productOptions
      DEFAULT N'[]';
END;
GO

IF COL_LENGTH('delivery.pizzas', 'crustConfig') IS NULL
BEGIN
  ALTER TABLE delivery.pizzas
    ADD crustConfig NVARCHAR(MAX) NOT NULL
      CONSTRAINT DF_delivery_pizzas_crustConfig
      DEFAULT N'{"enabled":false,"allowedCategoryIds":[]}';
END;
GO

IF OBJECT_ID(N'delivery.api_keys', N'U') IS NULL
BEGIN
  CREATE TABLE delivery.api_keys (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_delivery_api_keys PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    keyHash NVARCHAR(255) NOT NULL CONSTRAINT UQ_delivery_api_keys_keyHash UNIQUE,
    keyPrefix NVARCHAR(10) NOT NULL,
    active BIT NOT NULL CONSTRAINT DF_delivery_api_keys_active DEFAULT 1,
    lastUsedAt DATETIME2 NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_delivery_api_keys_createdAt DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2 NOT NULL CONSTRAINT DF_delivery_api_keys_updatedAt DEFAULT SYSUTCDATETIME()
  );
END;
GO

IF OBJECT_ID(N'delivery.adicional', N'U') IS NULL
BEGIN
  CREATE TABLE delivery.adicional (
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

  CREATE INDEX IX_delivery_adicional_guid_ativo_nome
    ON delivery.adicional(GUIDENTIDADE, ativo, nome);
END;
GO

IF OBJECT_ID(N'delivery.produto_adicional', N'U') IS NULL
BEGIN
  CREATE TABLE delivery.produto_adicional (
    productId INT NOT NULL,
    addonId INT NOT NULL,
    GUIDENTIDADE NVARCHAR(64) NOT NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_delivery_produto_adicional_createdAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_delivery_produto_adicional PRIMARY KEY (productId, addonId, GUIDENTIDADE),
    CONSTRAINT FK_delivery_produto_adicional_produto FOREIGN KEY (productId) REFERENCES delivery.pizzas(id),
    CONSTRAINT FK_delivery_produto_adicional_adicional FOREIGN KEY (addonId) REFERENCES delivery.adicional(id)
  );

  CREATE INDEX IX_delivery_produto_adicional_guid_product
    ON delivery.produto_adicional(GUIDENTIDADE, productId);
END;
GO

IF OBJECT_ID(N'delivery.orders', N'U') IS NULL
BEGIN
  CREATE TABLE delivery.orders (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_delivery_orders PRIMARY KEY,
    token NVARCHAR(64) NOT NULL CONSTRAINT UQ_delivery_orders_token UNIQUE,
    userId INT NULL,
    customerName NVARCHAR(150) NOT NULL,
    customerPhone NVARCHAR(20) NULL,
    addressStreet NVARCHAR(255) NOT NULL,
    addressNumber NVARCHAR(20) NOT NULL,
    addressComplement NVARCHAR(100) NULL,
    addressNeighborhood NVARCHAR(100) NOT NULL,
    addressCity NVARCHAR(100) NOT NULL,
    addressState NVARCHAR(2) NOT NULL,
    addressZip NVARCHAR(10) NULL,
    paymentMethod NVARCHAR(20) NOT NULL,
    changeFor DECIMAL(10,2) NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    deliveryFee DECIMAL(10,2) NOT NULL CONSTRAINT DF_delivery_orders_deliveryFee DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    status NVARCHAR(30) NOT NULL CONSTRAINT DF_delivery_orders_status DEFAULT N'received',
    notes NVARCHAR(MAX) NULL,
    receivedAt DATETIME2 NOT NULL CONSTRAINT DF_delivery_orders_receivedAt DEFAULT SYSUTCDATETIME(),
    preparingAt DATETIME2 NULL,
    outForDeliveryAt DATETIME2 NULL,
    deliveredAt DATETIME2 NULL,
    cancelledAt DATETIME2 NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_delivery_orders_createdAt DEFAULT SYSUTCDATETIME(),
    updatedAt DATETIME2 NOT NULL CONSTRAINT DF_delivery_orders_updatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_delivery_orders_user FOREIGN KEY (userId) REFERENCES delivery.users(id),
    CONSTRAINT CK_delivery_orders_paymentMethod CHECK (paymentMethod IN (N'cash', N'card', N'pix')),
    CONSTRAINT CK_delivery_orders_status CHECK (status IN (N'received', N'preparing', N'out_for_delivery', N'delivered', N'cancelled'))
  );

  CREATE INDEX IX_delivery_orders_status_createdAt ON delivery.orders(status, createdAt DESC);
  CREATE INDEX IX_delivery_orders_user_createdAt ON delivery.orders(userId, createdAt DESC);
END;
GO

IF COL_LENGTH('delivery.orders', 'deliveryType') IS NULL
BEGIN
  ALTER TABLE delivery.orders ADD deliveryType NVARCHAR(20) NULL;
END;
GO

IF OBJECT_ID(N'delivery.order_items', N'U') IS NULL
BEGIN
  CREATE TABLE delivery.order_items (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_delivery_order_items PRIMARY KEY,
    orderId INT NOT NULL,
    pizzaId INT NOT NULL,
    pizzaName NVARCHAR(150) NOT NULL,
    secondFlavorId INT NULL,
    secondFlavorName NVARCHAR(150) NULL,
    size NVARCHAR(32) NOT NULL,
    sizeLabel NVARCHAR(64) NOT NULL,
    crust NVARCHAR(50) NULL,
    crustPrice DECIMAL(10,2) NULL,
    quantity INT NOT NULL,
    unitPrice DECIMAL(10,2) NOT NULL,
    totalPrice DECIMAL(10,2) NOT NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_delivery_order_items_createdAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_delivery_order_items_order FOREIGN KEY (orderId) REFERENCES delivery.orders(id),
    CONSTRAINT FK_delivery_order_items_pizza FOREIGN KEY (pizzaId) REFERENCES delivery.pizzas(id),
    CONSTRAINT FK_delivery_order_items_second_pizza FOREIGN KEY (secondFlavorId) REFERENCES delivery.pizzas(id)
  );

  CREATE INDEX IX_delivery_order_items_orderId ON delivery.order_items(orderId);
END;
GO

IF OBJECT_ID(N'delivery.pedido_item_adicional', N'U') IS NULL
BEGIN
  CREATE TABLE delivery.pedido_item_adicional (
    id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_delivery_pedido_item_adicional PRIMARY KEY,
    orderItemId INT NOT NULL,
    addonId INT NULL,
    addonName NVARCHAR(150) NOT NULL,
    addonPrice DECIMAL(10,2) NOT NULL,
    quantity INT NOT NULL CONSTRAINT DF_delivery_pedido_item_adicional_quantity DEFAULT 1,
    totalPrice DECIMAL(10,2) NOT NULL,
    GUIDENTIDADE NVARCHAR(64) NOT NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DF_delivery_pedido_item_adicional_createdAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_delivery_pedido_item_adicional_item FOREIGN KEY (orderItemId) REFERENCES delivery.order_items(id),
    CONSTRAINT FK_delivery_pedido_item_adicional_adicional FOREIGN KEY (addonId) REFERENCES delivery.adicional(id),
    CONSTRAINT CK_delivery_pedido_item_adicional_price CHECK (addonPrice >= 0),
    CONSTRAINT CK_delivery_pedido_item_adicional_quantity CHECK (quantity > 0),
    CONSTRAINT CK_delivery_pedido_item_adicional_total CHECK (totalPrice >= 0)
  );

  CREATE INDEX IX_delivery_pedido_item_adicional_item
    ON delivery.pedido_item_adicional(orderItemId);
END;
GO
