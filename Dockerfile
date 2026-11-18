FROM node:20-bookworm-slim
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src
ENV NODE_ENV=production
USER node
EXPOSE 4000
# Apply migrations, then start. Safe with several replicas: Prisma takes an advisory lock while migrating.
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
