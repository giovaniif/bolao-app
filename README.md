# Bolão Brasileirão

Aplicativo de controle de bolão do Campeonato Brasileiro.

## Stack

- **Frontend**: React + TypeScript + Tailwind + Vite
- **Backend**: Go + Gin + PostgreSQL
- **Infra**: Docker Compose, ngrok (deploy)

---

## Modos de execução

| Modo      | API    | Frontend | Uso                         |
|-----------|--------|----------|-----------------------------|
| **Dev**   | 3333   | 5173     | Desenvolvimento com hot reload |
| **Deploy**| 3335   | 5175     | Docker + ngrok (compartilhar)  |

Portas diferentes evitam conflito: você pode rodar `make stop-deploy` e em seguida `make dev` sem conflito de portas.

### Modo desenvolvimento (alterações com hot reload)

Para trabalhar no código:

```bash
# 1. Suba só o banco (uma vez)
docker compose up db -d

# 2. Rode em modo dev
make dev
# ou: ./scripts/dev.sh
```

- **Frontend**: http://localhost:5173 (hot reload)
- **API**: http://localhost:3333

---

### Modo deploy (ngrok – compartilhar com usuários)

Para expor a aplicação na internet:

```bash
# 1. Sobe os containers
make deploy

# 2. Em outro terminal, inicia o ngrok
make ngrok
# ou: ngrok http 5175
```

Ngrok em terminal separado permite Ctrl+C sem derrubar os containers — você pode reiniciar o túnel quando quiser.

**Para parar:**
- Ctrl+C no ngrok → só fecha o túnel; containers continuam
- `make stop-deploy` → para os containers

---

### Comandos manuais (Docker)

```bash
docker compose up --build
# Frontend: http://localhost:5175 | API: http://localhost:3335
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
