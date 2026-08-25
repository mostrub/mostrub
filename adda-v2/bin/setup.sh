#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

need() {
  command -v "$1" >/dev/null 2>&1
}

install_postgres() {
  if need psql; then
    return
  fi
  if need brew; then
    brew install postgresql@16
    brew services start postgresql@16
    return
  fi
  if need pacman; then
    sudo pacman -S --needed --noconfirm postgresql
    if [[ ! -d /var/lib/postgres/data ]]; then
      sudo -u postgres initdb -D /var/lib/postgres/data
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
  echo "Install PostgreSQL 16, then re-run bin/setup.sh" >&2
  exit 1
}

psql_super() {
  if need sudo && id postgres >/dev/null 2>&1; then
    sudo -u postgres psql -v ON_ERROR_STOP=1 "$@"
  else
    psql -v ON_ERROR_STOP=1 "$@"
  fi
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

install_postgres
create_databases

if [[ ! -f .env ]]; then
  cp .env.example .env
fi

if ! need node || ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) < 22)'; then
  echo "Node.js 22 or newer is required." >&2
  exit 1
fi

npm install
echo "Ready. Seed and start with: bin/dev.sh"
