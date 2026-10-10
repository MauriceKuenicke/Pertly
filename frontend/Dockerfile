# syntax=docker/dockerfile:1
#
# Pertly frontend: Vite build served by unprivileged nginx on :8080, which also
# reverse-proxies /api to the backend service (see nginx.conf).

############################
# build
############################
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

COPY . .
RUN npm run build

############################
# runtime
############################
FROM nginxinc/nginx-unprivileged:1.30-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
