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

# Run db push on startup then start server
CMD sh -c "npx prisma db push --skip-generate --accept-data-loss && node dist/app.js"
