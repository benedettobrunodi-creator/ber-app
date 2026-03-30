FROM node:20-alpine
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npx prisma generate
RUN npm run build
RUN npm prune --production

# Create uploads directory (ephemeral — use Railway Volume or S3 for persistence)
RUN mkdir -p /tmp/uploads

EXPOSE ${PORT:-3000}

# Startup:
# 1. db push — aplica schema (sem --accept-data-loss para não apagar dados)
# 2. seed-users.sql — INSERT usuarios iniciais com ON CONFLICT DO NOTHING
#    (nunca sobrescreve senha alterada pelo usuario)
# 3. start server
CMD sh -c "npx prisma db push --skip-generate && \
  npx prisma db execute --file prisma/seed-users.sql --schema prisma/schema.prisma && \
  node dist/app.js"
