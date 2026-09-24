# API Reference

Base URL: `/api`

All protected endpoints require an `Authorization: Bearer <token>` header. Tokens are obtained via `POST /api/auth/login`.

---

## Authentication

### POST `/api/auth/login`

Authenticate with PIN.

**Rate-limited**: 5 requests per 30 seconds per IP.

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

## Cylinders

Gas cylinder refills. Each refill is saved on its own (not with the day's other
expenses) and kept by the weekly cleanup, so admin can review them by month.
Every add, edit and delete writes a `cylinder_refill` staff operation log; an
edit's log keeps the values before the change.

Brands: `HP` (Hindustan Petroleum), `BP` (Bharat Petroleum), `INDANE`.

### GET `/api/cylinders?date=YYYY-MM-DD`

The day's refills, oldest first. Any signed-in user.

```json
{
  "date": "2026-09-24",
  "refills": [
    { "id": 1, "refillDate": "2026-09-24", "brand": "HP", "amount": 950, "source": "Gupta Gas Agency", "createdBy": 1, "createdByName": "Cart Staff", "createdAt": "2026-09-24T10:49:00.000Z", "updatedByName": null, "updatedAt": null }
  ]
}
```

### POST `/api/cylinders`

```json
{ "refillDate": "2026-09-24", "brand": "INDANE", "amount": 905, "source": "Gupta Gas Agency" }
```

`amount` must be above 0 and at most 20000. `source` (where the cylinder came
from) is optional, at most 100 characters, and trimmed; blank means not
recorded. Responds `201` with the refill.

### PUT `/api/cylinders/:id`

Corrects a refill. Body is `{ brand, amount, source }` with the same rules; the
date and who first logged it do not change, and `updatedByName`/`updatedAt` are
set. Responds `200` with the refill, or `404`.

### GET `/api/cylinders/sources`

Sources used before, most recently used first (up to 20), for suggestions.

```json
{ "sources": ["Gupta Gas Agency", "Sharma Traders"] }
```

### DELETE `/api/cylinders/:id`

Removes a refill logged by mistake. Responds `200` with the removed refill, or `404`.

### GET `/api/admin/cylinders?month=YYYY-MM`

Admin only. The month's refills, newest first, with totals per brand and per
source (sources differing only in case are grouped; `null` is not recorded).

```json
{
  "month": "2026-09",
  "refills": [],
  "byBrand": [
    { "brand": "HP", "count": 1, "totalAmount": 950 },
    { "brand": "BP", "count": 0, "totalAmount": 0 },
    { "brand": "INDANE", "count": 0, "totalAmount": 0 }
  ],
  "bySource": [
    { "source": "Gupta Gas Agency", "count": 1, "totalAmount": 950 }
  ],
  "count": 1,
  "totalAmount": 950
}
```

---

## Staff

Staff share one login, so a staff member is identified by the name typed in.

### Staff takeaways: `/api/admin/takeaways`

Admin only. Momos a staff member took, priced at **25% off** the menu and kept
as an amount that person owes. A takeaway is not an order and never reaches
revenue, settlement or the admin summary, but its momos count against stock:
the stock screens read them and the minimum sale value subtracts them. The
discount is stored on each takeaway, so changing it later does not rewrite
history. Every add, edit and delete writes a `staff_takeaway` staff log.

- `POST` records one. `quantity` is momo pieces, as on orders (6 a full plate, 3 a half). Momos only; beverages are refused.

  ```json
  { "staffName": "Ramesh", "takeawayDate": "2026-09-24", "note": null,
    "items": [{ "menuItemId": 1, "quantity": 6, "isHalf": false }] }
  ```

  Responds `201`:

  ```json
  { "id": 1, "staffName": "Ramesh", "takeawayDate": "2026-09-24", "note": null,
    "items": [{ "menuItemId": 1, "itemName": "Veg Steam", "quantity": 6, "isHalf": false, "menuPrice": 89, "lineTotal": 66.75 }],
    "pieces": 6, "menuValue": 89, "discountPct": 25, "amountOwed": 66.75,
    "createdByName": "Owner", "createdAt": "...", "updatedByName": null, "updatedAt": null }
  ```

- `PUT /:id` with the same body corrects and reprices it: `200` or `404`.
- `DELETE /:id`: `200` with the removed takeaway, or `404`.
- `GET ?month=YYYY-MM`: `{ month, takeaways[], byStaff: [{ staffName, count, pieces, menuValue, amountOwed }], count, pieces, menuValue, amountOwed, discountPct }`, newest first, people who owe most first.

### GET `/api/staff/takeaway-items?date=YYYY-MM-DD`

Any signed-in user. The day's takeaway items as `{ date, items: [{ menuItemId, quantity }] }`,
so the staff stock screens count momos that left stock without being sold.

### GET `/api/staff/names`

Names used before in leaves or takeaways, most recent first, for suggestions.
Any signed-in user.

### Leaves: `/api/admin/leaves`

Admin only. Each add, edit and delete writes a `staff_leave` staff log.

- `GET ?month=YYYY-MM`: `{ month, leaves[], byStaff: [{ staffName, count }], count }`, newest first.
- `POST` `{ "staffName": "Ramesh", "leaveDate": "2026-09-24", "reason": "Fever" }`: `reason` is optional (up to 200 characters). Responds `201`, or `409` if that person is already marked absent that day (names compared ignoring case).
- `PUT /:id` with the same body: `200`, `404` or `409`.
- `DELETE /:id`: `200` with the removed leave, or `404`.

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
| 401 | Missing/invalid auth token |
| 403 | Insufficient role (e.g., non-admin accessing admin routes) |
| 404 | Resource not found |
| 429 | Rate limit exceeded (login endpoint) |
| 500 | Internal server error |