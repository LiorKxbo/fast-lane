# Quick Lane — serve the static game with Caddy behind HTTP Basic Auth.
# Railway builds this Dockerfile (it takes precedence over static detection),
# provides $PORT, and terminates HTTPS at its edge.
FROM caddy:2-alpine

COPY Caddyfile /etc/caddy/Caddyfile
COPY index.html /srv/index.html

# The base image's default entrypoint runs:
#   caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
EXPOSE 8080
