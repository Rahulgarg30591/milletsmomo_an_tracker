import { Request, Response, NextFunction } from 'express';
import { query, withTransaction } from '../db/pool.js';

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

    await withTransaction(async (client) => {
      for (const log of logs) {
        await client.query(
          `INSERT INTO client_activity_logs (user_id, user_role, log_type, page, details, metadata, device_info, duration_ms)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            log.userId ?? null,
            log.userRole ?? null,
            log.type,
            log.page ?? null,
            log.details ?? null,
            log.metadata ? JSON.stringify(log.metadata) : null,
            log.deviceInfo ?? null,
            log.durationMs ?? null,
          ],
        );
      }
    });

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

    let text = `
      SELECT id, user_id, user_role, log_type, page, details, metadata, device_info, duration_ms, created_at
      FROM client_activity_logs
      WHERE 1=1
    `;

    const params: unknown[] = [];

    if (date) {
      params.push(date);
      // created_at is stored with its zone, so the cast has to name the zone the
      // shop's day is measured in rather than trusting the session default.
      text += ` AND (created_at AT TIME ZONE 'Asia/Kolkata')::date = $${params.length}`;
    }

    if (logType) {
      params.push(logType);
      text += ` AND log_type = $${params.length}`;
    }

    text += ` ORDER BY created_at DESC`;
    params.push(Math.min(limit, 500));
    text += ` LIMIT $${params.length}`;

    const rows = await query<any>(text, params);

    const logs = rows.map((row) => {
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
