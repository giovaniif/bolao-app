# Bolão Brasileirão — working agreement

Prediction pool for the Brazilian championship. Go + Gin + PostgreSQL API (`api/`),
React + TypeScript + Vite frontend (`web/`).

Read `README.md` for how to run things locally. This file is about *how we write code here*.

## The five rules

1. **Every change ships with tests.** Coverage never goes down. → @.claude/testing.md
2. **All code is written in English** — identifiers, comments, commits, test names,
   and all repository documentation. Portuguese is reserved for user-facing product
   copy: UI strings in `web/` and API error messages. → @.claude/code-style.md
3. **Do not write comments** unless they explain behaviour that is genuinely hard to
   infer from the code. → @.claude/code-style.md
4. **Lint must pass for both `web/` and `api/`** before a PR goes up. → @.claude/linting.md
5. **Every task starts as an estimated Linear issue, and related work ships as a Graphite
   stack.** → @.claude/workflow.md

Codebase layout and the patterns to follow in each layer: @.claude/architecture.md

## Before you say a change is done

```bash
cd api && gofmt -l . && go vet ./... && go test ./... -short   # backend
cd web && npm run lint && npm test && npm run build            # frontend
```

Report what actually ran. A failing test named as passing is worse than no test.
