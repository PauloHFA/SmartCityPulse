FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/alertas-service/package.json ./apps/alertas-service/

RUN npm install

COPY packages/shared ./packages/shared
RUN npm run --workspace=@smartcity/shared build

COPY apps/alertas-service ./apps/alertas-service
RUN npm run --workspace=@smartcity/alertas-service build

FROM node:20-alpine AS runner

WORKDIR /usr/src/app
ENV NODE_ENV=production

COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/alertas-service/package.json ./apps/alertas-service/

RUN npm install --omit=dev

COPY --from=builder /usr/src/app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /usr/src/app/apps/alertas-service/dist ./apps/alertas-service/dist

CMD ["node", "apps/alertas-service/dist/index.js"]

