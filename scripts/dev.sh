#!/bin/bash
# Modo desenvolvimento: API + Frontend rodando localmente com hot reload
# Banco: usa Docker (apenas db) ou postgres local

set -e
cd "$(dirname "$0")/.."

echo "=== Modo DESENVOLVIMENTO ==="
echo ""

echo "Certifique-se de que o PostgreSQL está rodando na porta 5432:"
echo "  docker compose up db -d"
echo ""
echo "API: http://localhost:3333"
echo "Frontend: http://localhost:5173"
echo ""
echo "Pressione Ctrl+C para parar."
echo ""

# Instala dependências do frontend se necessário
[ ! -d web/node_modules ] && (cd web && npm install)

# Executa API e Web em paralelo (trap para matar ambos no Ctrl+C)
trap 'kill 0' EXIT
(cd api && go run ./cmd/server) &
(cd web && npm run dev) &
wait
