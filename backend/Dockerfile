# syntax=docker/dockerfile:1
# Real-build backend image (combo known_good_dockerfiles=false: the pipeline TRUSTS
# this file — keep the build+artifact+runtime stages and the migrate-then-start CMD).
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund --loglevel=error
COPY . .
RUN npx prisma generate
RUN npm run build
FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app ./
EXPOSE 3000
CMD sh -c 'npx prisma migrate deploy || npx prisma db push --accept-data-loss || true; npm run start:prod'
