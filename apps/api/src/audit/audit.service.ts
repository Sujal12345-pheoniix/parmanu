import { prisma } from '../prisma/client';
import { AuthenticatedRequest } from '../security/auth';

export interface RecordAuditParams {
  action: string;
  entityType: string;
  entityId: string;
  before?: any;
  after?: any;
  reason?: string;
  req?: AuthenticatedRequest;
}

/**
 * Redacts known sensitive fields from audit payload snapshots
 */
function sanitizeAuditSnapshot(data: any): any {
  if (!data || typeof data !== 'object') return data;
  const clone = { ...data };
  const sensitiveKeys = ['password', 'passwordHash', 'accessToken', 'refreshToken', 'secret'];
  for (const key of Object.keys(clone)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s.toLowerCase()))) {
      clone[key] = '[REDACTED]';
    } else if (typeof clone[key] === 'object') {
      clone[key] = sanitizeAuditSnapshot(clone[key]);
    }
  }
  return clone;
}

/**
 * Records an immutable audit log entry in the PostgreSQL database.
 */
export async function logAuditEvent(params: RecordAuditParams): Promise<void> {
  try {
    const actorId = params.req?.user?.id || null;
    const actorRole = params.req?.user?.role || (actorId ? 'USER' : 'SYSTEM');
    const ipAddress = (params.req?.headers['x-forwarded-for'] as string) || params.req?.socket?.remoteAddress || null;
    const userAgent = (params.req?.headers['user-agent'] as string) || null;

    await prisma.auditLog.create({
      data: {
        actorId,
        actorRole,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        before: params.before ? sanitizeAuditSnapshot(params.before) : undefined,
        after: params.after ? sanitizeAuditSnapshot(params.after) : undefined,
        reason: params.reason || null,
        ipAddress,
        userAgent,
      },
    });
  } catch (err: any) {
    // Audit logging should never crash the primary flow, but must be logged to stderr
    console.error(`[AUDIT_LOG_ERROR] Failed to record audit log for ${params.action} on ${params.entityType}:${params.entityId}:`, err.message);
  }
}
