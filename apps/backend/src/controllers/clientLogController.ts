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
