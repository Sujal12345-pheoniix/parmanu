import { Request, Response } from 'express';
import { checkDatabaseHealth } from '../prisma/client';

export async function getHealth(req: Request, res: Response): Promise<void> {
  const dbHealth = await checkDatabaseHealth();
  const isHealthy = dbHealth.ok;

  const payload = {
    status: isHealthy ? 'healthy' : 'degraded',
    version: '1.0.0',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    services: {
      database: {
        status: dbHealth.ok ? 'connected' : 'disconnected',
        latencyMs: dbHealth.latencyMs,
        error: dbHealth.error,
      },
      runtime: {
        nodeVersion: process.version,
        memoryUsageMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
      },
    },
  };

  res.status(isHealthy ? 200 : 503).json(payload);
}

export async function getReadiness(req: Request, res: Response): Promise<void> {
  const dbHealth = await checkDatabaseHealth();
  if (dbHealth.ok) {
    res.status(200).json({ ready: true, timestamp: new Date().toISOString() });
  } else {
    res.status(503).json({ ready: false, reason: 'Database connection unavailable', error: dbHealth.error });
  }
}
