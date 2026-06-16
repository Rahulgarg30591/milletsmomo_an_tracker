# API Reference

Base URL: `/api`

All protected endpoints require an `Authorization: Bearer <token>` header. Tokens are obtained via `POST /api/auth/login`.

---

## Authentication

### POST `/api/auth/login`

Authenticate with PIN.

**Rate-limited**: 5 requests per 15 minutes per IP.

#### Request

```json
{
  "role": "staff" | "admin",
  "pin": "1234"
}
```

#### Response `200`

```json
{
  "token": "eyJhbGciOi...",
  "role": "staff",
  "displayName": "Staff User",
  "expiresIn": 43200
}
```

#### Error `401`

```json
{ "error": "Invalid PIN" }
```

#### Error `429`

Rate limit exceeded.

---

## Menu

### GET `/api/menu`

Returns the canonical 6×4 menu grid. **Requires authentication.**

#### Response `200`

```json
{
  "items": [
    {
      "id": 1,
      "filling": "Veg",
      "preparation": "Steam",
      "displayName": "Veg Steam",
      "fullPrice": 89,
      "halfPrice": 50
    }
  ]
}
```

24 items total, ordered by preparation then filling.

---

## Orders

### GET `/api/orders?date=YYYY-MM-DD`

List all orders for a given date. **Requires authentication.**

#### Query Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `date` | `string` | Yes | Date in `YYYY-MM-DD` format |

#### Response `200`

```json
{
  "date": "2026-06-17",
  "orders": [
    {
      "id": 1718609400000,
      "orderDate": "2026-06-17",
      "timeLabel": "2:30 PM",
      "orderType": "dine",
      "paymentMethod": "cash",
      "isCompleted": false,
      "totalAmount": 178,
      "items": [
        {
          "menuItemId": 1,
          "itemName": "Veg Steam",
          "quantity": 2,
          "isHalf": false,
          "unitPrice": 89,
          "lineTotal": 178
        }
      ]
    }
  ]
}
```

---

### POST `/api/orders`

Create a new order. **Requires authentication.** The server recomputes the total from the canonical menu — client-sent totals are ignored.

#### Request

```json
{
  "orderDate": "2026-06-17",
  "orderType": "dine" | "pack",
  "paymentMethod": "cash" | "upi" | "pending",
  "items": [
    {
      "menuItemId": 1,
      "quantity": 2,
      "isHalf": false
    }
  ]
}
```

**Validation** (Zod):
- `orderDate`: must match `YYYY-MM-DD`
- `orderType`: `"dine"` or `"pack"`
- `paymentMethod`: `"cash"`, `"upi"`, or `"pending"`
- `items`: array of ≥1 items, each with `menuItemId` (positive int), `quantity` (positive int), `isHalf` (boolean)

#### Response `201`

Returns the full created order including computed totals and item names.

```json
{
  "id": 1718609400000,
  "orderDate": "2026-06-17",
  "timeLabel": "2:30 PM",
  "orderType": "dine",
  "paymentMethod": "cash",
  "isCompleted": false,
  "totalAmount": 178,
  "items": [
    {
      "menuItemId": 1,
      "itemName": "Veg Steam",
      "quantity": 2,
      "isHalf": false,
      "unitPrice": 89,
      "lineTotal": 178
    }
  ]
}
```

#### Error `400`

- Invalid or missing fields
- Unknown `menuItemId`
- Empty items array

---

### PATCH `/api/orders/:id/complete`

Mark an order as completed. For orders created with `paymentMethod: "pending"`, a new payment method must be provided.

#### Request (optional body)

```json
{
  "paymentMethod": "cash" | "upi"
}
```

#### Response `200`

```json
{
  "id": 1718609400000,
  "completed": true
}
```

#### Error `400`

- Order already completed
- Pending order without `paymentMethod`

#### Error `404`

Order not found.

---

### DELETE `/api/orders/:id`

Delete an order.

#### Response `200`

```json
{
  "deleted": true,
  "id": 1718609400000
}
```

#### Error `404`

Order not found.

---

## Admin

### GET `/api/admin/summary?date=YYYY-MM-DD`

Get aggregated summary for a date. **Requires `admin` role.**

#### Query Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `date` | `string` | Yes | Date in `YYYY-MM-DD` format |

#### Response `200`

```json
{
  "date": "2026-06-17",
  "totalOrders": 12,
  "totalRevenue": 2456,
  "pendingAmount": 180,
  "cashTotal": 1200,
  "upiTotal": 1076,
  "itemBreakdown": [
    {
      "itemName": "Veg Steam",
      "totalQuantity": 8,
      "totalRevenue": 712
    }
  ],
  "orders": [
    {
      "id": 1718609400000,
      "orderDate": "2026-06-17",
      "timeLabel": "2:30 PM",
      "orderType": "dine",
      "paymentMethod": "cash",
      "isCompleted": true,
      "totalAmount": 178,
      "items": [ ... ]
    }
  ]
}
```

#### Error `403`

User is not an admin.

---

## Health

### GET `/api/health`

Returns service health status. No authentication required.

#### Response `200`

```json
{ "status": "ok" }
```

---

## Error Responses

All errors follow this format:

```json
{ "error": "Description of the error" }
```

Common HTTP status codes:

| Status | Meaning |
|---|---|
| 400 | Validation error or bad request |
| 401 | Missing/invalid JWT token |
| 403 | Insufficient role (e.g., non-admin accessing admin routes) |
| 404 | Resource not found |
| 429 | Rate limit exceeded (login endpoint) |
| 500 | Internal server error |