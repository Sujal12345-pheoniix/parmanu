import { z } from 'zod';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from root or local directory
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const EnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_EXPIRATION: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('*'),
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters').default('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
  ADMIN_REGISTRATION_KEY: z.string().min(8, 'ADMIN_REGISTRATION_KEY must be at least 8 characters').default('parmanu_admin_setup_key_2026'),
  GNEWS_API_KEY: z.string().optional(),
  GUARDIAN_API_KEY: z.string().optional(),
  INSTAGRAM_APP_ID: z.string().optional(),
  INSTAGRAM_APP_SECRET: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type EnvConfig = z.infer<typeof EnvironmentSchema>;

let validatedEnv: EnvConfig;

export function getEnv(): EnvConfig {
  if (validatedEnv) {
    return validatedEnv;
  }

  const result = EnvironmentSchema.safeParse(process.cwd() ? process.env : {});
  if (!result.success) {
    const errorDetails = result.error.errors.map((e) => `[${e.path.join('.')}]: ${e.message}`).join('\n');
    console.error('❌ FATAL: Invalid environment configuration:\n' + errorDetails);
    // Exit immediately to prevent running with invalid/missing security credentials
    process.exit(1);
  }

  validatedEnv = result.data;
  return validatedEnv;
}

/**
 * Mask secret string for safe logging
 */
export function maskSecret(secret?: string | null): string {
  if (!secret) return '(empty)';
  if (secret.length <= 8) return '****';
  return secret.slice(0, 4) + '...' + secret.slice(-4);
}
