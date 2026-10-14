import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { getEnv } from '../config/env';
import { UserRole, AuthTokenPayload } from '@parmanu/types';

const SALT_ROUNDS = 12;

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  name?: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  requestId?: string;
}

/**
 * Hashes a plaintext password securely.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verifies a plaintext password against stored hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generates a signed JWT access token.
 */
export function signToken(user: AuthenticatedUser): string {
  const env = getEnv();
  const payload: AuthTokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRATION as any,
  });
}

/**
 * Verifies and decodes a JWT access token.
 */
export function verifyToken(token: string): AuthenticatedUser {
  const env = getEnv();
  const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload & AuthTokenPayload;

  return {
    id: decoded.sub,
    email: decoded.email,
    role: decoded.role,
    name: decoded.name,
  };
}

/**
 * Authentication middleware that extracts and validates the Bearer token.
 */
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Authentication token required',
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  try {
    const user = verifyToken(token);
    req.user = user;
    next();
  } catch (err: any) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired authentication token',
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
  }
}

/**
 * Optional authentication middleware: sets req.user if valid token provided, but doesn't block unauthenticated.
 */
export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const user = verifyToken(token);
      req.user = user;
    } catch {
      // Ignore invalid token on optional auth
    }
  }
  next();
}

/**
 * Role-based authorization middleware enforcing server-side access control.
 */
export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: `Forbidden: role '${req.user.role}' is not authorized for this resource. Required: [${allowedRoles.join(', ')}]`,
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
      });
      return;
    }

    next();
  };
}
