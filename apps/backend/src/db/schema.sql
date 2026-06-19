IF OBJECT_ID('StaffOperationLogs', 'U') IS NOT NULL DROP TABLE StaffOperationLogs;
IF OBJECT_ID('DailyClosingStock', 'U') IS NOT NULL DROP TABLE DailyClosingStock;
IF OBJECT_ID('SupplyVerifications', 'U') IS NOT NULL DROP TABLE SupplyVerifications;
IF OBJECT_ID('SupplyOrderLogs', 'U') IS NOT NULL DROP TABLE SupplyOrderLogs;
IF OBJECT_ID('DailySupplyOrderItems', 'U') IS NOT NULL DROP TABLE DailySupplyOrderItems;
IF OBJECT_ID('DailySupplyOrders', 'U') IS NOT NULL DROP TABLE DailySupplyOrders;
IF OBJECT_ID('SupplyItems', 'U') IS NOT NULL DROP TABLE SupplyItems;
IF OBJECT_ID('OrderItems', 'U') IS NOT NULL DROP TABLE OrderItems;
IF OBJECT_ID('Orders', 'U') IS NOT NULL DROP TABLE Orders;
IF OBJECT_ID('MenuItems', 'U') IS NOT NULL DROP TABLE MenuItems;
IF OBJECT_ID('Users', 'U') IS NOT NULL DROP TABLE Users;

CREATE TABLE Users (
  id           INT IDENTITY(1,1) PRIMARY KEY,
  username     NVARCHAR(50)  NOT NULL UNIQUE,
  role         NVARCHAR(20)  NOT NULL CHECK (role IN ('staff','admin')),
  pin_hash     NVARCHAR(255) NOT NULL,
  display_name NVARCHAR(100) NOT NULL,
  is_active    BIT           NOT NULL DEFAULT 1,
  created_at   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE MenuItems (
  id           INT IDENTITY(1,1) PRIMARY KEY,
  filling      NVARCHAR(30)  NOT NULL,
  preparation  NVARCHAR(30)  NOT NULL,
  display_name NVARCHAR(60)  NOT NULL,
  full_price   DECIMAL(6,2)  NOT NULL,
  half_price   DECIMAL(6,2)  NOT NULL,
  is_active    BIT           NOT NULL DEFAULT 1,
  CONSTRAINT UQ_MenuItems_Combo UNIQUE (filling, preparation)
);

CREATE TABLE Orders (
  id              BIGINT        NOT NULL PRIMARY KEY,
  order_date      DATE          NOT NULL,
  time_label      NVARCHAR(20)  NOT NULL,
  order_type      NVARCHAR(10)  NOT NULL CHECK (order_type IN ('dine','pack')),
  payment_method  NVARCHAR(10)  NOT NULL CHECK (payment_method IN ('cash','upi','pending')),
  is_completed    BIT           NOT NULL DEFAULT 0,
  total_amount    DECIMAL(8,2)  NOT NULL,
  created_by      INT           NULL REFERENCES Users(id),
  created_at      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
  completed_at    DATETIME2     NULL
);

CREATE INDEX IX_Orders_OrderDate  ON Orders(order_date);
CREATE INDEX IX_Orders_Completed  ON Orders(order_date, is_completed);

CREATE TABLE OrderItems (
  id            INT     IDENTITY(1,1) PRIMARY KEY,
  order_id      BIGINT  NOT NULL REFERENCES Orders(id) ON DELETE CASCADE,
  menu_item_id  INT     NOT NULL REFERENCES MenuItems(id),
  item_name     NVARCHAR(60)  NOT NULL,
  quantity      INT     NOT NULL CHECK (quantity > 0),
  is_half       BIT     NOT NULL DEFAULT 0,
  unit_price    DECIMAL(6,2)  NOT NULL,
  line_total    DECIMAL(8,2)  NOT NULL
);

CREATE INDEX IX_OrderItems_OrderId ON OrderItems(order_id);

CREATE TABLE SupplyItems (
  id            INT IDENTITY(1,1) PRIMARY KEY,
  name          NVARCHAR(60)  NOT NULL UNIQUE,
  category      NVARCHAR(20)  NOT NULL CHECK (category IN ('momo_packet','sauce','dip')),
  unit_price    DECIMAL(8,2)  NOT NULL,
  pieces_per    INT           NOT NULL DEFAULT 1,
  display_name  NVARCHAR(80)  NOT NULL,
  is_active     BIT           NOT NULL DEFAULT 1
);

CREATE TABLE DailySupplyOrders (
  id            INT IDENTITY(1,1) PRIMARY KEY,
  order_date    DATE          NOT NULL,
  total_cost    DECIMAL(10,2) NOT NULL,
  created_by    INT           NOT NULL REFERENCES Users(id),
  created_at    DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_DailySupplyOrders_Date UNIQUE (order_date)
);

CREATE TABLE DailySupplyOrderItems (
  id              INT IDENTITY(1,1) PRIMARY KEY,
  order_id        INT     NOT NULL REFERENCES DailySupplyOrders(id) ON DELETE CASCADE,
  supply_item_id  INT     NOT NULL REFERENCES SupplyItems(id),
  quantity        INT     NOT NULL CHECK (quantity > 0),
  unit_price      DECIMAL(8,2) NOT NULL,
  line_total      DECIMAL(10,2) NOT NULL
);

CREATE INDEX IX_DailySupplyOrderItems_OrderId ON DailySupplyOrderItems(order_id);

CREATE TABLE SupplyOrderLogs (
  id            INT IDENTITY(1,1) PRIMARY KEY,
  order_date    DATE          NOT NULL,
  action        NVARCHAR(10)  NOT NULL CHECK (action IN ('CREATE','UPDATE')),
  created_by    INT           NOT NULL REFERENCES Users(id),
  created_at    DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
  item_summary  NVARCHAR(500) NOT NULL
);

CREATE INDEX IX_SupplyOrderLogs_Date ON SupplyOrderLogs(order_date DESC);
CREATE INDEX IX_SupplyOrderLogs_CreatedAt ON SupplyOrderLogs(created_at DESC);

CREATE TABLE SupplyVerifications (
  id              INT IDENTITY(1,1) PRIMARY KEY,
  order_date      DATE          NOT NULL,
  supply_item_id  INT           NOT NULL REFERENCES SupplyItems(id),
  expected_qty    INT           NOT NULL,
  actual_qty      INT           NOT NULL,
  has_conflict    BIT           NOT NULL DEFAULT 0,
  reported_by     INT           NOT NULL REFERENCES Users(id),
  created_at      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_SupplyVerification_DateItem UNIQUE (order_date, supply_item_id)
);

CREATE INDEX IX_SupplyVerifications_Date ON SupplyVerifications(order_date DESC);

CREATE TABLE DailyClosingStock (
  id              INT IDENTITY(1,1) PRIMARY KEY,
  order_date      DATE          NOT NULL,
  supply_item_id  INT           NOT NULL REFERENCES SupplyItems(id),
  packets_left    INT           NOT NULL DEFAULT 0,
  pieces_left     INT           NOT NULL DEFAULT 0 CHECK (pieces_left >= 0 AND pieces_left < 24),
  reported_by     INT           NOT NULL REFERENCES Users(id),
  created_at      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_DailyClosingStock_DateItem UNIQUE (order_date, supply_item_id)
);

CREATE INDEX IX_DailyClosingStock_Date ON DailyClosingStock(order_date DESC);

CREATE TABLE StaffOperationLogs (
  id              INT IDENTITY(1,1) PRIMARY KEY,
  order_date      DATE          NOT NULL,
  operation_type  NVARCHAR(20)  NOT NULL CHECK (operation_type IN ('verification','closing_stock','order_create')),
  created_by      INT           NOT NULL REFERENCES Users(id),
  created_at      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
  details         NVARCHAR(500) NOT NULL
);

CREATE INDEX IX_StaffOperationLogs_Date ON StaffOperationLogs(order_date DESC);
CREATE INDEX IX_StaffOperationLogs_CreatedAt ON StaffOperationLogs(created_at DESC);
CREATE INDEX IX_StaffOperationLogs_Type ON StaffOperationLogs(operation_type);