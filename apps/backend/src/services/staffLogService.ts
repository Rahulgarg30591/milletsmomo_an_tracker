import sql from 'mssql';
import { getPool } from '../db/pool.js';
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
  const pool = await getPool();
  const request = pool.request();
  request.input('orderDate', sql.Date, orderDate);
  request.input('operationType', sql.NVarChar, operationType);
  request.input('createdBy', sql.Int, createdBy);
  request.input('details', sql.NVarChar, details);
  const metadataJson = metadata ? JSON.stringify(metadata) : null;
  request.input('metadata', sql.NVarChar, metadataJson);
  await request.query(
    `INSERT INTO StaffOperationLogs (order_date, operation_type, created_by, details, metadata)
     VALUES (@orderDate, @operationType, @createdBy, @details, @metadata)`,
  );
}

export async function getLogs(
  date?: string,
  operationType?: string,
  limit = 50,
): Promise<StaffOperationLog[]> {
  const pool = await getPool();
  let query = `
    SELECT l.id, l.order_date, l.operation_type, l.created_by, l.created_at, l.details, l.metadata, u.display_name
    FROM StaffOperationLogs l
    JOIN Users u ON l.created_by = u.id
    WHERE 1=1
  `;

  const request = pool.request();

  if (date) {
    query += ` AND l.order_date = @date`;
    request.input('date', sql.Date, date);
  }

  if (operationType) {
    query += ` AND l.operation_type = @operationType`;
    request.input('operationType', sql.NVarChar, operationType);
  }

  query += ` ORDER BY l.created_at DESC`;
  query += ` OFFSET 0 ROWS FETCH NEXT ${limit} ROWS ONLY`;

  const result = await request.query(query);
  return result.recordset.map((row: any) => ({
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
