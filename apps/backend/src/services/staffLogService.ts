import sql from 'mssql';
import { getPool } from '../db/pool.js';
import { formatDate } from '../utils/dateUtils.js';

export interface StaffOperationLog {
  id: number;
  orderDate: string;
  operationType: 'verification' | 'closing_stock' | 'order_create';
  createdBy: number;
  createdAt: string;
  details: string;
  displayName: string;
}

export async function createLog(
  orderDate: string,
  operationType: 'verification' | 'closing_stock' | 'order_create',
  createdBy: number,
  details: string,
): Promise<void> {
  const pool = await getPool();
  const request = pool.request();
  request.input('orderDate', sql.Date, orderDate);
  request.input('operationType', sql.NVarChar, operationType);
  request.input('createdBy', sql.Int, createdBy);
  request.input('details', sql.NVarChar, details);
  await request.query(
    `INSERT INTO StaffOperationLogs (order_date, operation_type, created_by, details)
     VALUES (@orderDate, @operationType, @createdBy, @details)`,
  );
}

export async function getLogs(
  date?: string,
  operationType?: string,
  limit = 50,
): Promise<StaffOperationLog[]> {
  const pool = await getPool();
  let query = `
    SELECT l.id, l.order_date, l.operation_type, l.created_by, l.created_at, l.details, u.display_name
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
    operationType: row.operation_type,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    details: row.details,
    displayName: row.display_name,
  }));
}
