.PHONY: dev deploy stop-deploy

# Modo desenvolvimento: API + Frontend com hot reload (requer postgres na 5432)
dev:
	./scripts/dev.sh

# Modo deploy: Docker + ngrok (expõe a aplicação na internet)
deploy:
	./scripts/deploy.sh

# Para o deploy (containers Docker)
stop-deploy:
	./scripts/stop-deploy.sh
