#!/bin/bash
# Modo deploy: sobe a aplicação com Docker e opcionalmente ngrok
# Ngrok em terminal separado para que Ctrl+C não derrube os containers

set -e
cd "$(dirname "$0")/.."

echo "=== Modo DEPLOY ==="
echo ""

# Sobe os containers
echo "Iniciando containers..."
docker compose up -d --build

echo ""
echo "Aguardando serviços iniciarem..."
sleep 5

WEB_PORT=5175

echo ""
echo "Containers rodando. API: http://localhost:3335 | Frontend: http://localhost:$WEB_PORT"
echo ""
echo "Para expor via ngrok, rode em OUTRO terminal:"
echo "  make ngrok   (ou: ngrok http $WEB_PORT)"
echo ""
echo "Assim, ao apertar Ctrl+C no ngrok, apenas o túnel para e os containers continuam."
echo ""
echo "Para parar os containers: make stop-deploy"
echo ""
