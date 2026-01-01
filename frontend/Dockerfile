#
# 프런트엔드 Next.js 애플리케이션 Dockerfile
# 멀티스테이지 빌드로 의존성 → 빌드 → 실행 스테이지를 분리한다.
#

FROM node:22-alpine3.20 AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine3.20 AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_BASE
ARG NEXT_PUBLIC_FIXTURE
ENV NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE} \
    NEXT_PUBLIC_FIXTURE=${NEXT_PUBLIC_FIXTURE:-0}
RUN npm run build

FROM node:22-alpine3.20 AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache curl
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=5 \
  CMD curl -f http://localhost:3000/healthz || exit 1
CMD ["npm", "run", "start"]
