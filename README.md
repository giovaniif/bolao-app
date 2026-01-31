# Bolão Brasileirão

Aplicativo de controle de bolão do Campeonato Brasileiro.

## Stack

- **Frontend**: React + TypeScript + Tailwind + Vite
- **Backend**: Go + Gin + PostgreSQL
- **Infra**: Docker Compose

## Como rodar

### Com Docker (recomendado)

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- API: http://localhost:8080

### Desenvolvimento local (sem Docker Compose)

Rode API e frontend em terminais separados. O frontend faz proxy de `/api` para a API.

**1. PostgreSQL** – precisa estar rodando na porta 5432:
```bash
# Opção: só o banco via Docker
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=bolao --name bolao-db postgres:16-alpine
```

**2. API** (terminal 1):
```bash
cd api
go run ./cmd/server
```
- Escuta em http://localhost:3333
- Variáveis: `DATABASE_URL`, `PORT`, `JWT_SECRET` (opcional, já tem defaults)

**3. Frontend** (terminal 2):
```bash
cd web
npm install && npm run dev
```
- App em http://localhost:5173
- API em outra porta? Crie `web/.env` com `VITE_API_URL=http://localhost:SUA_PORTA`

## Primeiro acesso

1. Crie o primeiro usuário admin via SQL:

```sql
INSERT INTO users (id, username, display_name, is_admin, amount_paid)
VALUES (gen_random_uuid(), 'admin', 'Administrador', true, 0);
```

2. Acesse http://localhost:5173 e faça login com o usuário `admin`.

3. Como admin, cadastre os demais usuários e adicione os jogos das rodadas.

## Funcionalidades

- **Admin**: cadastrar usuários, adicionar jogos, definir data de fechamento, preencher resultados, acompanhar pagamentos (R$ 70 total)
- **Jogadores**: preencher palpites até a data de fechamento
- **Classificação**: baseada nos critérios definidos em `criterios.md`
- **Rodadas parciais**: filtro por rodada para ver classificação acumulada

## Testes

```bash
# Backend
cd api && go test ./...

# Frontend
cd web && npm run test
```
