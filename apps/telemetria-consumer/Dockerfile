FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/telemetria-consumer/package.json ./apps/telemetria-consumer/

RUN npm install

COPY packages/shared ./packages/shared
RUN npm run --workspace=@smartcity/shared build

COPY apps/telemetria-consumer ./apps/telemetria-consumer
RUN npm run --workspace=@smartcity/telemetria-consumer build

FROM node:20-alpine AS runner

WORKDIR /usr/src/app
ENV NODE_ENV=production

COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/telemetria-consumer/package.json ./apps/telemetria-consumer/

RUN npm install --omit=dev

COPY --from=builder /usr/src/app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /usr/src/app/apps/telemetria-consumer/dist ./apps/telemetria-consumer/dist

CMD ["node", "apps/telemetria-consumer/dist/index.js"]

