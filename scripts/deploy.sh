#!/bin/bash
# Modo deploy: sobe a aplicação com Docker e expõe via ngrok
# Acesso público: URL gerada pelo ngrok

set -e
cd "$(dirname "$0")/.."

echo "=== Modo DEPLOY (ngrok) ==="
echo ""

# Verifica se ngrok está instalado
if ! command -v ngrok &>/dev/null; then
  echo "ngrok não encontrado. Instale em: https://ngrok.com/download"
  echo "Ou com: snap install ngrok  /  brew install ngrok"
  exit 1
fi

# Sobe os containers
echo "Iniciando containers..."
docker compose up -d --build

echo ""
echo "Aguardando serviços iniciarem..."
sleep 5

# Porta do frontend (web) exposta pelo docker compose
WEB_PORT=5173

echo ""
echo "Expondo via ngrok na porta $WEB_PORT..."
echo "A URL pública aparecerá abaixo. Compartilhe com os usuários."
echo ""
echo "Para parar: docker compose down  (e Ctrl+C no ngrok)"
echo ""

ngrok http "$WEB_PORT"
