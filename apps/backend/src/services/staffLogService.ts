import { query, queryOnce } from '../db/pool.js';
import { formatDate } from '../utils/dateUtils.js';

export type StaffOperationType =
  | 'verification'
  | 'closing_stock'
  | 'order_create'
  | 'order_update'
  | 'order_complete'
  | 'order_delete'
  | 'supply_order'
  | 'payment_settlement'
  | 'expense_save'
  | 'login';

export interface StaffOperationLog {
  id: number;
  orderDate: string;
  operationType: StaffOperationType;
  createdBy: number;
  createdAt: string;
  details: string;
  metadata: Record<string, any> | null;
  displayName: string;
}

export async function createLog(
  orderDate: string,
  operationType: StaffOperationType,
  createdBy: number,
  details: string,
  metadata?: Record<string, any>,
): Promise<void> {
  const metadataJson = metadata ? JSON.stringify(metadata) : null;
  // queryOnce, not query: this is the only INSERT outside a transaction, and a
  // retried insert would leave two log rows for one operation.
  await queryOnce(
    `INSERT INTO staff_operation_logs (order_date, operation_type, created_by, details, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [orderDate, operationType, createdBy, details, metadataJson],
  );
}

export async function getLogs(
  date?: string,
  operationType?: string,
  limit = 50,
): Promise<StaffOperationLog[]> {
  let text = `
    SELECT l.id, l.order_date, l.operation_type, l.created_by, l.created_at, l.details, l.metadata, u.display_name
    FROM staff_operation_logs l
    JOIN users u ON l.created_by = u.id
    WHERE 1=1
  `;

  const params: unknown[] = [];

  if (date) {
    params.push(date);
    text += ` AND l.order_date = $${params.length}`;
  }

  if (operationType) {
    params.push(operationType);
    text += ` AND l.operation_type = $${params.length}`;
  }

  text += ` ORDER BY l.created_at DESC`;
  params.push(limit);
  text += ` LIMIT $${params.length}`;

  const rows = await query<any>(text, params);
  return rows.map((row) => ({
    id: row.id,
    orderDate: formatDate(row.order_date),
    operationType: row.operation_type as StaffOperationType,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    details: row.details,
    metadata: row.metadata ? safeParse(row.metadata) : null,
    displayName: row.display_name,
  }));
}

function safeParse(raw: string): Record<string, any> | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
