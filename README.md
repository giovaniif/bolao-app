# Bolão Brasileirão

Aplicativo de controle de bolão do Campeonato Brasileiro.

## Stack

- **Frontend**: React + TypeScript + Tailwind + Vite
- **Backend**: Go + Gin + PostgreSQL
- **Infra**: Docker Compose (dev), Render (API), Vercel (frontend), Supabase (banco)

---

## Desenvolvimento local

Rode cada serviço individualmente:

### 1. Banco de dados

```bash
docker compose up db -d
```

Sobe o PostgreSQL em `localhost:5432` (usuário `postgres`, senha `postgres`, banco `bolao`).

### 2. API

```bash
cd api
DATABASE_URL=postgres://postgres:postgres@localhost:5432/bolao?sslmode=disable \
JWT_SECRET=qualquer-segredo \
go run ./cmd/server
```

API disponível em http://localhost:3333. As migrations rodam automaticamente na inicialização.

### 3. Frontend

```bash
cd web
VITE_API_URL=http://localhost:3333 npm run dev
```

Frontend disponível em http://localhost:5173.

---

## Docker Compose completo (opcional)

Para rodar tudo via Docker (sem hot reload):

```bash
docker compose up --build
# Frontend: http://localhost:5175 | API: http://localhost:3335
```

---

## Deploy em produção

### Banco de dados – Supabase

O banco de dados roda no Supabase (PostgreSQL gerenciado). As migrations rodam automaticamente na inicialização da API.

Use a URL de **session pooler** (IPv4) para evitar problemas de conectividade

### API – Render

A API é deployada no Render via Docker (`render.yaml` na raiz do projeto).

Variáveis de ambiente necessárias no Render:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | URL do session pooler do Supabase |
| `JWT_SECRET` | String aleatória segura (ex: `openssl rand -hex 32`) |
| `PORT` | `8080` (já definido no `render.yaml`) |

### Frontend – Vercel

O frontend é deployado no Vercel apontando para o diretório `web/`.

| Configuração | Valor |
|---|---|
| Root Directory | `web` |
| Install Command | `npm install` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

Variável de ambiente necessária:

| Variável | Valor |
|---|---|
| `VITE_API_URL` | URL da API no Render |

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

## Seed de palpites

Para importar palpites de um arquivo (ex: primeira rodada):

```bash
make seed-palpites
# ou: cd api && go run ./cmd/seed-palpites ../palpites.md
```

O arquivo `palpites.md` deve ter:
1. Ordem dos jogos (Mandante x Visitante)
2. Para cada usuário: nome (username) seguido dos placares na mesma ordem

Exemplo:
```
Ordem dos jogos:
Vitória x Remo
Atlético-MG x Palmeiras
...

usuario1
1x2
0x1
...
```

## Testes

```bash
# Backend
cd api && go test ./...

# Frontend
cd web && npm run test
```
