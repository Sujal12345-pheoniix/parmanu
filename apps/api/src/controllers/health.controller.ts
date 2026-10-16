import { Request, Response } from 'express';
import { checkDatabaseHealth } from '../prisma/client';

export async function getHealth(req: Request, res: Response): Promise<void> {
  // Liveness probe: verifies process is alive and responsive
  res.status(200).json({
    status: 'healthy',
    probe: 'liveness',
    version: '2.3.0',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    runtime: {
      nodeVersion: process.version,
      memoryUsageMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
    },
  });
}

export async function getReadiness(req: Request, res: Response): Promise<void> {
  // Readiness probe: verifies critical dependencies (Neon DB) are operational
  const dbHealth = await checkDatabaseHealth();
  if (dbHealth.ok) {
    res.status(200).json({
      status: 'ready',
      probe: 'readiness',
      database: {
        status: 'connected',
        latencyMs: dbHealth.latencyMs,
      },
      timestamp: new Date().toISOString(),
    });
  } else {
    res.status(503).json({
      status: 'unready',
      probe: 'readiness',
      database: {
        status: 'disconnected',
        message: 'Database connection unavailable',
      },
      timestamp: new Date().toISOString(),
    });
  }
}
