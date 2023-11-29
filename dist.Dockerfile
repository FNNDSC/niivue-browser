# Build on-the-metal, deploy using Docker

FROM docker.io/library/caddy:2.7.5-alpine
COPY ./Caddyfile /etc/caddy/Caddyfile
COPY ./dist /app/dist

EXPOSE 2019 8080
CMD ["caddy", "run", "-c", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
