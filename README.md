# Bolão Brasileirão

Aplicativo de controle de bolão do Campeonato Brasileiro.

## Stack

- **Frontend**: React + TypeScript + Tailwind + Vite
- **Backend**: Go + Gin + PostgreSQL
- **Infra**: Docker Compose, ngrok (deploy)

---

## Modos de execução

### Modo desenvolvimento (alterações com hot reload)

Para trabalhar no código com recarregamento automático:

```bash
# 1. Suba só o banco (uma vez)
docker compose up db -d

# 2. Rode em modo dev
make dev
# ou: ./scripts/dev.sh
```

- **Frontend**: http://localhost:5173 (hot reload)
- **API**: http://localhost:3333 (reinicia ao alterar Go)

> **Importante**: Se o deploy (Docker) estiver rodando, pare antes com `make stop-deploy` para liberar as portas 3333 e 5173.

---

### Modo deploy (ngrok – compartilhar com usuários)

Para expor a aplicação na internet via ngrok:

```bash
make deploy
# ou: ./scripts/deploy.sh
```

1. Sobe API + Frontend + Banco em containers
2. Inicia ngrok e exibe a URL pública (ex: `https://abc123.ngrok-free.app`)
3. Compartilhe a URL com os usuários

**Requisito**: [ngrok](https://ngrok.com/download) instalado e configurado (auth token opcional para URLs fixas).

**Para parar o deploy:**
```bash
make stop-deploy
# ou: ./scripts/stop-deploy.sh
```
Depois pressione Ctrl+C no terminal do ngrok.

---

### Comandos manuais (Docker)

```bash
# Tudo com Docker (sem ngrok)
docker compose up --build

# Frontend: http://localhost:5173 | API: http://localhost:3333
```

---

## Primeiro acesso

1. Crie o primeiro usuário admin via SQL (senha padrão inicial: `123`):

```sql
INSERT INTO users (id, username, display_name, is_admin, amount_paid, password_hash, must_change_password)
VALUES (
  gen_random_uuid(),
  'admin',
  'Administrador',
  true,
  0,
  '$2a$10$uTr26SWYWuGs.D/j0JJtf.ClwuNgzbE38JRdB76Xoyk41JKdNKkv2',
  true
);
```

2. Acesse o app e faça login com usuário `admin` e senha `123`.

3. No primeiro acesso, altere a senha obrigatoriamente.

4. Como admin, cadastre os demais usuários (todos começam com senha `123`) e adicione os jogos das rodadas.

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
