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