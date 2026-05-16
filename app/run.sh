#!/usr/bin/env bash
# UW-Crushes local runner — always open http://localhost:8000
#
#   ./run.sh dev   — Vite is the public server (proxy). It serves the React app with
#                    HMR and forwards /api, /media, /ws to Django on :8001.
#   ./run.sh prod  — Django serves the built frontend + API on :8000 (no Vite).
#
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$APP_DIR/.." && pwd)"
BACKEND_DIR="$APP_DIR/backend-django"
FRONTEND_DIR="$APP_DIR/frontend-vite"
FRONTEND_DIST="$BACKEND_DIR/frontend_dist"
ENV_FILE="$REPO_ROOT/.env"

APP_PORT="${APP_PORT:-8000}"
BACKEND_PORT_DEV="${BACKEND_PORT_DEV:-8001}"

BACKEND_PID=""
FRONTEND_PID=""

usage() {
  cat <<EOF
Usage: $(basename "$0") <command>

Commands:
  dev     Development — Vite on :${APP_PORT} proxies API to Django :${BACKEND_PORT_DEV}
  prod    Production  — Django on :${APP_PORT} serves built frontend + API
  build   Build frontend into backend-django/frontend_dist only
  migrate Run Django migrations

Environment:
  Loads ${ENV_FILE} when present.
  Override ports: APP_PORT=8080 BACKEND_PORT_DEV=8081 ./run.sh dev
EOF
}

log() { printf '\033[1;36m→\033[0m %s\n' "$*"; }
die() { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }

load_env() {
  if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
  fi
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

cleanup() {
  local code=$?
  [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
  [[ -n "$BACKEND_PID" ]] && kill "$BACKEND_PID" 2>/dev/null || true
  wait 2>/dev/null || true
  exit "$code"
}

trap cleanup EXIT INT TERM

ensure_backend_deps() {
  require_cmd uv
  if [[ ! -d "$BACKEND_DIR/.venv" ]]; then
    log "Installing Python dependencies (uv sync)…"
    (cd "$BACKEND_DIR" && uv sync)
  fi
}

ensure_frontend_deps() {
  require_cmd npm
  if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
    log "Installing frontend dependencies (npm ci)…"
    (cd "$FRONTEND_DIR" && npm ci)
  fi
}

run_migrate() {
  ensure_backend_deps
  log "Running migrations…"
  (cd "$BACKEND_DIR" && uv run manage.py migrate --noinput)
}

wait_for_backend() {
  local url="http://127.0.0.1:${1}/api/health/"
  local i
  for i in $(seq 1 60); do
    if curl -sf "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.25
  done
  die "Backend did not become ready at $url"
}

build_frontend() {
  ensure_frontend_deps
  log "Building frontend…"
  (cd "$FRONTEND_DIR" && npm run build)
  log "Copying dist → $FRONTEND_DIST"
  rm -rf "$FRONTEND_DIST"
  cp -R "$FRONTEND_DIR/dist" "$FRONTEND_DIST"
}

start_backend() {
  local port="$1"
  local environment="$2"
  local frontend_dist="${3:-}"

  ensure_backend_deps
  run_migrate

  export ENVIRONMENT="$environment"
  export CSRF_TRUSTED_ORIGINS="${CSRF_TRUSTED_ORIGINS:-http://localhost:${APP_PORT}}"

  if [[ -n "$frontend_dist" ]]; then
    export FRONTEND_DIST="$frontend_dist"
  else
    unset FRONTEND_DIST
  fi

  log "Starting Django (daphne) on http://127.0.0.1:${port} [${environment}]…"
  (
    cd "$BACKEND_DIR"
    exec uv run daphne -b 127.0.0.1 -p "$port" config.asgi:application
  ) &
  BACKEND_PID=$!
  wait_for_backend "$port"
}

cmd_dev() {
  load_env
  export ENVIRONMENT=development

  start_backend "$BACKEND_PORT_DEV" "development"

  ensure_frontend_deps
  log "Starting Vite proxy on http://localhost:${APP_PORT} → Django http://127.0.0.1:${BACKEND_PORT_DEV}"
  (
    cd "$FRONTEND_DIR"
    export APP_PORT
    export BACKEND_URL="http://127.0.0.1:${BACKEND_PORT_DEV}"
    exec npm run dev -- --host 127.0.0.1 --port "$APP_PORT" --strictPort
  ) &
  FRONTEND_PID=$!

  log "Ready — open http://localhost:${APP_PORT}"
  wait "$FRONTEND_PID"
}

cmd_prod() {
  load_env
  build_frontend
  start_backend "$APP_PORT" "production" "$FRONTEND_DIST"

  if [[ ! -f "$FRONTEND_DIST/index.html" ]]; then
    die "Missing $FRONTEND_DIST/index.html after build"
  fi

  log "Ready — open http://localhost:${APP_PORT}"
  wait "$BACKEND_PID"
}

cmd_build() {
  load_env
  build_frontend
  log "Built → $FRONTEND_DIST"
}

main() {
  local cmd="${1:-}"
  case "$cmd" in
    dev)     cmd_dev ;;
    prod)    cmd_prod ;;
    build)   cmd_build ;;
    migrate) load_env; run_migrate ;;
    -h|--help|help|"") usage ;;
    *) die "Unknown command: $cmd (try: dev, prod, build, migrate)" ;;
  esac
}

main "$@"
