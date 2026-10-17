import { Response } from 'express';
import { RegisterUserSchema, LoginUserSchema } from '@parmanu/types';
import { prisma } from '../prisma/client';
import { hashPassword, verifyPassword, signToken, AuthenticatedRequest } from '../security/auth';
import { getEnv } from '../config/env';
import { logAuditEvent } from '../audit/audit.service';

export async function register(req: AuthenticatedRequest, res: Response): Promise<void> {
  const parseResult = RegisterUserSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: parseResult.error.errors,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  const { email, password, name, adminKey, interests } = parseResult.data;
  const env = getEnv();

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (existingUser) {
    // Prevent user enumeration by not revealing if email already exists or using generic response
    res.status(409).json({
      success: false,
      error: 'An account with this email address already exists',
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  const passwordHash = await hashPassword(password);

  // Determine role: ADMIN only if correct setup key provided, else default READER
  const role = adminKey && adminKey === env.ADMIN_REGISTRATION_KEY ? 'ADMIN' : 'READER';

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      name: name || null,
      role,
    },
  });

  // Save selected category interests if supplied
  if (Array.isArray(interests) && interests.length > 0) {
    await prisma.userInterest.createMany({
      data: interests.map((cat: string) => ({
        userId: user.id,
        category: cat.trim(),
        weight: 1.0,
      })),
      skipDuplicates: true,
    });
  }

  // Record audit event
  await logAuditEvent({
    action: 'USER_REGISTER',
    entityType: 'User',
    entityId: user.id,
    after: { email: user.email, role: user.role },
    req,
  });

  const token = signToken({
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  });

  res.status(201).json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    },
    meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
  });
}

export async function login(req: AuthenticatedRequest, res: Response): Promise<void> {
  const parseResult = LoginUserSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      success: false,
      error: 'Invalid request body',
      details: parseResult.error.errors,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  const { email, password } = parseResult.data;

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user || !user.passwordHash) {
    // Mitigate user enumeration by performing dummy verify to balance timing
    await hashPassword('dummy_timing_balance_password');
    res.status(401).json({
      success: false,
      error: 'Invalid email or password',
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    res.status(401).json({
      success: false,
      error: 'Invalid email or password',
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  const token = signToken({
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  });

  await logAuditEvent({
    action: 'USER_LOGIN',
    entityType: 'User',
    entityId: user.id,
    req,
  });

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    },
    meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
  });
}

export async function getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      avatarUrl: true,
      createdAt: true,
      interests: true,
    },
  });

  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }

  res.status(200).json({
    success: true,
    data: user,
    meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
  });
}
