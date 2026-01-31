#!/bin/bash
# Para o modo deploy (containers Docker)

cd "$(dirname "$0")/.."
echo "Parando containers..."
docker compose down
echo "Deploy encerrado."
