.PHONY: dev deploy ngrok stop-deploy

# Modo desenvolvimento: API + Frontend com hot reload (requer postgres na 5432)
dev:
	./scripts/dev.sh

# Modo deploy: sobe os containers (ngrok em outro terminal)
deploy:
	./scripts/deploy.sh

# Expõe o frontend via ngrok (rode após make deploy, em outro terminal)
ngrok:
	ngrok http 5175

# Para o deploy (containers Docker)
stop-deploy:
	./scripts/stop-deploy.sh
