FROM node:19 AS build

RUN curl -f https://get.pnpm.io/v6.16.js | node - add --global pnpm

WORKDIR /app

# Required files by 'pnpm install'
COPY .npmrc package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY . ./
RUN pnpm build

FROM nginx:1.19-alpine
COPY --from=build /app/build /usr/share/nginx/html
