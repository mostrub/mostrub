#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

need() {
  command -v "$1" >/dev/null 2>&1
}

node_major() {
  node -e 'process.stdout.write(process.versions.node.split(".")[0])' 2>/dev/null || echo 0
}

install_node() {
  if need node && [[ "$(node_major)" -ge 22 ]]; then
    return
  fi
  if need brew; then
    brew install node@22
    export PATH="$(brew --prefix node@22)/bin:${PATH}"
    return
  fi
  if need pacman; then
    sudo pacman -S --needed --noconfirm nodejs npm
    return
  fi
  if need apt-get; then
    sudo apt-get update
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs npm
    if [[ "$(node_major)" -lt 22 ]]; then
      curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
      sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
    fi
    return
  fi
  echo "Node.js 22 oder neuer installieren, dann bin/setup.sh erneut." >&2
  exit 1
}

install_postgres() {
  if need psql && pg_isready -h 127.0.0.1 >/dev/null 2>&1; then
    return
  fi
  if need brew; then
    brew install postgresql@16
    brew services start postgresql@16
    export PATH="$(brew --prefix postgresql@16)/bin:${PATH}"
    return
  fi
  if need pacman; then
    sudo pacman -S --needed --noconfirm postgresql
    if [[ ! -d /var/lib/postgres/data ]]; then
      sudo -u postgres initdb -D /var/lib/postgres/data --locale=C.UTF-8 --encoding=UTF8
    fi
    sudo systemctl enable --now postgresql
    return
  fi
  if need apt-get; then
    sudo apt-get update
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql postgresql-contrib
    sudo systemctl enable --now postgresql
    return
  fi
  echo "PostgreSQL 16 installieren, dann bin/setup.sh erneut." >&2
  exit 1
}

psql_super() {
  if need sudo && id postgres >/dev/null 2>&1; then
    sudo -u postgres psql -v ON_ERROR_STOP=1 "$@"
    return
  fi
  if need brew; then
    psql -v ON_ERROR_STOP=1 "$@"
    return
  fi
  psql -v ON_ERROR_STOP=1 "$@"
}

create_databases() {
  psql_super postgres <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ledger') THEN
    CREATE ROLE ledger LOGIN PASSWORD 'ledger';
  END IF;
END
$$;
SQL
  for db in ledger ledger_test; do
    if ! psql_super -tAc "SELECT 1 FROM pg_database WHERE datname='${db}'" postgres | grep -q 1; then
      psql_super -c "CREATE DATABASE ${db} OWNER ledger;" postgres
    fi
  done
}

install_node
install_postgres
create_databases

if [[ ! -f .env ]]; then
  cp .env.example .env
fi

if [[ "$(node_major)" -lt 22 ]]; then
  echo "Node.js 22 oder neuer ist nötig." >&2
  exit 1
fi

npm install
echo "Bereit. Übungsdaten und Start: bin/dev.sh --seed 2026-08-24"
