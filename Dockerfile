# Build in Docker

FROM docker.io/library/node:21.2.0-alpine3.18 AS build

# See https://pnpm.io/docker
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

COPY package.json .
COPY pnpm-lock.yaml .
RUN --mount=type=cache,sharing=private,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

FROM docker.io/library/caddy:2.7.5-alpine

# remove capabilities to make it work on OpenShift
RUN setcap -r /usr/bin/caddy

COPY ./Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /app/dist

EXPOSE 2019 8080
CMD ["caddy", "run", "-c", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
