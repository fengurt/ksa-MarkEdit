#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cloud_dir="$repo_root/Cloud"
web_dir="$repo_root/WebApp"
env_file="$cloud_dir/.env.tencent"
bewell_dir=/opt/bewell/deploy
edge_config=/opt/mathmappri01/docker/edge/nginx.conf
backup_root=/opt/ksamint/backups
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_dir="$backup_root/$timestamp"

mkdir -p "$backup_dir"

if [ ! -f "$env_file" ]; then
    umask 077
    postgres_password=$(openssl rand -hex 32)
    cat > "$env_file" <<EOF
POSTGRES_PASSWORD=$postgres_password
KSAMINT_ALLOW_REGISTRATION=true
EOF
fi

docker run --rm \
    -v "$repo_root:/work" \
    -w /work/WebApp \
    -e VITE_API_BASE=https://api.notes.apuch.cn \
    -e VITE_ACCOUNT_ENABLED=true \
    -e VITE_BASE_PATH=/ \
    node:22-alpine \
    sh -c 'npm ci && npm run build'

docker compose \
    --env-file "$env_file" \
    -f "$cloud_dir/docker-compose.tencent.yml" \
    up -d --build

for attempt in $(seq 1 30); do
    if docker exec ksamint-web wget -qO- http://ksamint-api:8080/healthz >/dev/null 2>&1; then
        break
    fi
    if [ "$attempt" -eq 30 ]; then
        docker logs --tail 100 ksamint-api
        exit 1
    fi
    sleep 2
done

cp "$cloud_dir/tencent-shared.Caddyfile" "$backup_dir/tencent-shared.Caddyfile"
docker cp "$cloud_dir/tencent-shared.Caddyfile" bewell-web-1:/tmp/ksamint.Caddyfile
docker exec bewell-web-1 caddy validate --config /tmp/ksamint.Caddyfile

cp "$bewell_dir/docker-compose.yml" "$backup_dir/bewell-docker-compose.yml"
cp "$edge_config" "$backup_dir/edge-nginx.conf"

docker compose \
    --env-file "$bewell_dir/.env" \
    -f "$bewell_dir/docker-compose.yml" \
    -f "$cloud_dir/tencent-bewell.override.yml" \
    up -d --no-build web

if ! grep -q 'KSAMINT NOTES REDIRECT' "$edge_config"; then
    perl -0pi -e 's~\n    server \{\n        listen 80 default_server;~\n    # KSAMINT NOTES REDIRECT\n    server {\n        listen 80;\n        server_name notes.apuch.cn api.notes.apuch.cn;\n        return 308 https://\$host\$request_uri;\n    }\n\n    server {\n        listen 80 default_server;~' "$edge_config"
fi

if ! docker exec edge-nginx nginx -t; then
    cp "$backup_dir/edge-nginx.conf" "$edge_config"
    docker exec edge-nginx nginx -t
    exit 1
fi
docker exec edge-nginx nginx -s reload

docker exec bewell-web-1 caddy validate --config /etc/caddy/Caddyfile
docker ps --filter name=ksamint --format '{{.Names}} {{.Status}}'
printf 'backup=%s\n' "$backup_dir"
