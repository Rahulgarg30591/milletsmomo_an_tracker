import { Request, Response, NextFunction } from 'express';
import sql from 'mssql';
import { getPool } from '../db/pool.js';

export async function createClientLogs(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { logs } = req.body;
    if (!Array.isArray(logs) || logs.length === 0) {
      res.status(400).json({ error: 'Invalid input: logs array required' });
      return;
    }

    const pool = await getPool();
    const transaction = pool.transaction();
    await transaction.begin();

    try {
      for (const log of logs) {
        const request = transaction.request();
        request.input('userId', sql.Int, log.userId ?? null);
        request.input('userRole', sql.VarChar, log.userRole ?? null);
        request.input('logType', sql.VarChar, log.type);
        request.input('page', sql.VarChar, log.page ?? null);
        request.input('details', sql.NVarChar, log.details ?? null);
        request.input('metadata', sql.NVarChar, log.metadata ? JSON.stringify(log.metadata) : null);
        request.input('deviceInfo', sql.NVarChar, log.deviceInfo ?? null);
        request.input('durationMs', sql.Int, log.durationMs ?? null);

        await request.query(
          `INSERT INTO ClientActivityLogs (user_id, user_role, log_type, page, details, metadata, device_info, duration_ms)
           VALUES (@userId, @userRole, @logType, @page, @details, @metadata, @deviceInfo, @durationMs)`,
        );
      }
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    res.status(201).json({ success: true, inserted: logs.length });
  } catch (err) {
    next(err);
  }
}

export async function getClientLogs(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const date = req.query.date as string | undefined;
    const logType = req.query.type as string | undefined;
    const limit = parseInt(req.query.limit as string, 10) || 200;

    const pool = await getPool();
    const request = pool.request();

    let query = `
      SELECT id, user_id, user_role, log_type, page, details, metadata, device_info, duration_ms, created_at
      FROM ClientActivityLogs
      WHERE 1=1
    `;

    if (date) {
      query += ` AND CAST(created_at AS DATE) = @date`;
      request.input('date', sql.Date, date);
    }

    if (logType) {
      query += ` AND log_type = @logType`;
      request.input('logType', sql.VarChar, logType);
    }

    query += ` ORDER BY created_at DESC`;
    query += ` OFFSET 0 ROWS FETCH NEXT ${Math.min(limit, 500)} ROWS ONLY`;

    const result = await request.query(query);

    const logs = result.recordset.map((row: any) => {
      let metadata = null;
      try { metadata = row.metadata ? JSON.parse(row.metadata) : null; } catch { metadata = row.metadata; }

      return {
        id: row.id,
        userId: row.user_id,
        userRole: row.user_role,
        type: row.log_type,
        page: row.page,
        details: row.details,
        metadata,
        deviceInfo: row.device_info,
        durationMs: row.duration_ms,
        createdAt: row.created_at.toISOString(),
      };
    });

    res.json({ logs });
  } catch (err) {
    next(err);
  }
}