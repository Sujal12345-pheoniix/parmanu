# Production Dockerfile for Parmanu Backend API
FROM node:20-alpine AS builder

WORKDIR /app

# Install openssl required by Prisma
RUN apk add --no-cache openssl

# Copy root and package manifests for clean layer caching
COPY package.json package-lock.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/

# Install workspace dependencies
RUN npm ci

# Copy packages and API source code
COPY packages/config ./packages/config
COPY packages/types ./packages/types
COPY apps/api ./apps/api

# Build types and API bundle
RUN npm run --workspace=@parmanu/types build
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN npx tsc -p apps/api/tsconfig.json

# ─── Production Runner Stage ───
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

RUN apk add --no-cache openssl

# Copy runtime assets from builder
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Expose backend port
EXPOSE 3001

# Start production server
CMD ["node", "apps/api/dist/server.js"]
