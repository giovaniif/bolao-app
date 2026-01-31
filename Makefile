.PHONY: dev deploy ngrok stop-deploy seed-palpites

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

# Inserir palpites do palpites.md no banco (rodada 1)
# Requer: postgres rodando, jogos da rodada 1 e usuários já cadastrados
seed-palpites:
	cd api && go run ./cmd/seed-palpites ../palpites.md
