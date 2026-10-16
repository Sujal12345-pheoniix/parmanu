import { PrismaClient } from '@prisma/client';
import { getEnv } from '../config/env';

// Ensure environment is validated before initializing client
getEnv();

const globalForPrisma = global as unknown as { prisma: PrismaClient };

let _prismaInstance: PrismaClient | null = null;

function getPrismaClient(): PrismaClient {
  if (!_prismaInstance) {
    if (globalForPrisma.prisma) {
      _prismaInstance = globalForPrisma.prisma;
    } else {
      try {
        _prismaInstance = new PrismaClient({
          log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
        });
        if (process.env.NODE_ENV !== 'production') {
          globalForPrisma.prisma = _prismaInstance;
        }
      } catch (err: any) {
        // If PrismaClient is not initialized yet (e.g., CI before generate), provide a graceful fallback proxy
        console.warn('[PrismaClient] Initialization deferred:', err.message);
        _prismaInstance = new Proxy({} as any, {
          get(_target, prop) {
            if (prop === '$queryRaw' || prop === '$connect' || prop === '$disconnect') {
              return async () => {
                throw new Error('Database not connected: Prisma client not generated or DB offline');
              };
            }
            return new Proxy({}, {
              get(_modelTarget, method) {
                return async () => {
                  throw new Error(`Prisma operation ${String(prop)}.${String(method)} failed: Prisma client not generated`);
                };
              },
            });
          },
        });
      }
    }
  }
  return _prismaInstance!;
}

// Lazy export to prevent top-level module load failures during test suite execution
export const prisma: PrismaClient = new Proxy({} as any, {
  get(_target, prop) {
    const client = getPrismaClient();
    const val = (client as any)[prop];
    if (typeof val === 'function') {
      return val.bind(client);
    }
    return val;
  },
});

export async function checkDatabaseHealth(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err: any) {
    return { ok: false, latencyMs: Date.now() - start, error: err.message };
  }
}
