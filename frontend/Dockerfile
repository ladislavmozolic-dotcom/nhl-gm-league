# ProfiNHL league — production image (Next 16 + Prisma).
# Simple + reliable: build the app, run `next start` with node_modules present
# (Prisma client + engines come along, no standalone-tracing footguns). openssl is
# required by the Prisma query engine on Debian slim.

FROM node:22-slim AS base
WORKDIR /app
# openssl: required by Prisma query engine; python3 + ca-certificates: used by ep-scraper.py
# to bypass Cloudflare Bot Management when fetching EliteProspects player pages
RUN apt-get update && apt-get install -y --no-install-recommends openssl python3 ca-certificates && rm -rf /var/lib/apt/lists/*

# --- deps: install all packages (needed for prisma generate + next build) ---
FROM base AS deps
COPY package*.json ./
RUN npm ci

# --- builder: generate Prisma client, build Next ---
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# --- runner: the lean-ish runtime ---
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/data ./data
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
# EP scraper Python script — runs via child_process from ep-scraper.ts
COPY --from=builder /app/lib/ep-scraper.py ./lib/ep-scraper.py
# uploaded logos/wordmarks live here; the compose volume mounts over it so they persist
RUN mkdir -p ./public/uploads/site
EXPOSE 3000
CMD ["npm", "start"]
