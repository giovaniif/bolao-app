# Code style

Two rules govern everything here: **code is written in English**, and **comments are the
exception**. The rest is convention already visible in the codebase.

## 1. Code is English

Identifiers, function and type names, test names, commit messages, branch names, and
**comments** are written in English — always, including in files that currently are not.
This extends to all repository documentation (`README.md`, `SCORING.md`, everything under
`.claude/`) and to everything we write *about* the code: Linear issue titles and
descriptions, PR titles and PR descriptions.

Portuguese stays in exactly three places, all user-facing product copy, none of it prose
we write for each other:

| Portuguese is correct | Why |
|---|---|
| UI copy in `web/` (labels, buttons, empty states) | The app's users are Brazilian |
| API error messages returned to the client | `shared/api/client.ts` surfaces `data.error` straight into the UI — they are user-facing copy, not code |
| Route paths and query-param *values* | `/palpites`, `?rodada=7`, `?aba=galera` appear in links people share |

The identifiers around those params are still English: `useTabInUrl<RoundTab>('aba', …)`
reads a Portuguese value into an English type.

So this is right, not a violation:

```go
c.JSON(http.StatusBadRequest, gin.H{"error": "rodada inválida"})
```

And this is a violation to fix when you touch the surrounding code:

```go
// Bônus por quantidade diferente de placares acertados  ← rewrite in English
```

### Domain vocabulary

`bolão` is the product's core noun and has no clean English equivalent. It stays as
`bolao` / `Bolao` / `boloes` in identifiers, JSON fields, and database columns — the DB
schema and API contract already use it and changing that is not a style fix.

Everything else uses its English name, which is the direction the codebase is already
moving in: `round` (not `rodada`), `match` (not `jogo`), `prediction` (not `palpite`),
`partial` (not `parcial`), `classification`, `participant`.

Older identifiers that break this (`PartiaisPage`, `usePartiais`, the `parciais/` feature
folder) are legacy. Rename them when you are already refactoring that area and the rename
is contained; do not open a repo-wide rename PR on the side of a feature.

**Routes and query params are user-facing and stay Portuguese**: `/palpites`, `/parciais`,
`?rodada=7`. They appear in shared links.

### New code, and code you touch

- New files: English throughout, no exceptions.
- Existing files: translate the comments in the block you are editing. Leave the rest —
  a diff full of unrelated translations buries the actual change.

## 2. Comments only when they earn their place

Write a comment when a reader who understands the language still cannot work out **why**
the code is the way it is:

- A non-obvious invariant or edge case that a future edit would break.
- A workaround for external behaviour, naming the cause.
- A business rule whose source is outside the code (`SCORING.md`, the spreadsheet).

Good — every one of these is load-bearing:

```go
// counted > 0: with nothing counted, roundPredTotal is 0 vacuously and would match an
// all-0-0 round, rewarding a player who predicted nothing.
if awardRoundTotalBonus && counted > 0 && roundPredTotal == actualRoundTotal {
```

```go
// Sentinel: missing prediction, market still open (see EffectivePredEntry).
if p.PredHome < 0 || p.PredAway < 0 {
```

Bad — delete these on sight:

```go
// Build prediction map by match index
predMap := make(map[int]PredEntry)

// Correct away goals: 3 points
if predAway == realAway {
	points += PointsCorrectAwayGoals
}
```

The second one is a comment doing a constant's job. `PointsCorrectAwayGoals` already says
it. Prefer a named constant, a named helper, or a clearer variable name over a comment —
the comment is what you reach for when naming genuinely cannot carry the meaning.

Exported Go identifiers whose purpose isn't obvious from the signature get a doc comment
in the standard `// Name does X.` form. That is documentation, not narration, and is fine.

## Go conventions (`api/`)

- Layering is strict: `handler → service → repository`. Details in `.claude/architecture.md`.
- Constructors are `NewXRepository(pool)` / `NewXHandler(deps...)` returning a pointer;
  dependencies are struct fields, wired in `cmd/server/main.go`.
- Every repository method takes `ctx context.Context` first and passes
  `c.Request.Context()` down from the handler.
- SQL is a raw string with positional `$1` placeholders. Never build SQL by concatenating
  input.
- Return errors up; do not log-and-continue. Handlers decide the status code.
- `defer rows.Close()` after every `Query`, and return `rows.Err()` at the end of the loop.
- Nullable columns map to pointer fields (`*int`, `*time.Time`) with `json:",omitempty"`.
- Secrets never land in a struct that gets serialized: `PasswordHash string \`json:"-"\``.
- Run `gofmt` — non-negotiable, CI-visible.

## TypeScript / React conventions (`web/`)

- Function components, named exports, one component per file, PascalCase filename.
- Server state is TanStack Query only — never `useState` + `useEffect` for fetching.
  Every key comes from `shared/query/queryKeys.ts`; no inline key arrays.
- Data fetching lives in `features/<feature>/api/*.ts` and goes through the shared
  `api<T>()` helper in `shared/api/client.ts`, which handles auth headers, error shape,
  and 204s. Do not call `fetch` directly from a component.
- Hooks in `features/<feature>/hooks/` wrap the query/mutation and own cache invalidation:

  ```ts
  export function useSavePredictions(round: number) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: savePredictions,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.predictions(round) });
      },
    });
  }
  ```

- API response types are `interface`s declared next to the function that returns them, with
  `snake_case` fields matching the Go JSON tags. Do not remap casing at the boundary.
- No `any`. Narrow `unknown` with a type guard, as `client.ts` does on the error body.
- Pages compose; components stay presentational and take data via props.
- Styling is Tailwind utility classes inline. No CSS modules, no styled-components.
- Shared UI primitives (`Button`, `Input`, `Layout`) live in `shared/components/` — reach
  for them before writing another bespoke button.
