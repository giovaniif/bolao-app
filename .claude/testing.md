# Testing

**Rule: every change ships with tests, and coverage never goes down.**

A change that alters behaviour without touching a test file is incomplete. If you truly
cannot test something, say so explicitly in the PR description and explain why — don't
let it pass silently.

## Coverage policy

"Never lower coverage" is measured per package (Go) and per file (web):

```bash
cd api && go test ./... -short -cover        # per-package percentages
cd web && npm test
```

Record the number for the package you are touching before your change and after it. If it
dropped, you added untested code — fix it before opening the PR.

Current backend baseline (`go test ./... -short -cover`, as of the last audit):

| Package | Coverage |
|---|---|
| `internal/service` | ~47% — the scoring/classification core, the part worth defending |
| `internal/repository` | DB-backed test, skipped under `-short` |
| `internal/handler`, `internal/auth`, `internal/config` | 0% — new code here must arrive with tests |

New packages start at a high bar. Do not let a fresh file land at 0%.

> Gap to close: `web/` has no coverage reporter installed (`@vitest/coverage-v8`), and
> neither CI workflow enforces a coverage floor. Until that is fixed, coverage is checked
> by review, not by machine. Adding the reporter and a CI threshold is a tracked task.

## What to test, by layer

### `api/internal/service` — the priority

Pure functions holding the business rules: scoring, classification, round detection,
effective predictions, export. No database, no HTTP. These are the tests that matter most
and they are cheap to write — anything with a scoring or standings rule behind it belongs
here. Since `criterios.md` is missing from the repo (see `.claude/architecture.md`), these
tests *are* the specification: a rule with no test case is a rule nobody can verify.

Use table-driven tests, one case per rule and per edge, with names that state the rule in
plain language (see `internal/service/round_test.go`):

```go
func TestSummarizeRoundsActive(t *testing.T) {
	tests := []struct {
		name       string
		matches    []models.Match
		wantActive int
	}{
		{
			name:       "nothing finished yet, first round is active",
			matches:    []models.Match{scheduled(1), scheduled(2)},
			wantActive: 1,
		},
		// The weekend case: the market has closed and games are being played,
		// but no results are in, so the round stays active.
		{
			name:       "round partially filled in stays active",
			matches:    []models.Match{played(1), played(2), scheduled(2)},
			wantActive: 2,
		},
	}

	for _, tt := range tests {
		got := SummarizeRounds(tt.matches)
		if got.Active != tt.wantActive {
			t.Errorf("%s: active = %d, want %d", tt.name, got.Active, tt.wantActive)
		}
	}
}
```

Conventions:

- Small local builders (`played(round)`, `scheduled(round)`, `user({...})`) instead of
  repeating literal structs.
- Failure messages carry the case name and both values: `got = X, want Y`.
- `t.Errorf` to keep checking other cases; `t.Fatalf` only when continuing is meaningless.
- Scoring changes must include a case per points constant they touch, plus the boundary
  (a 4+ goal match, an exact draw, a round with a missing prediction).

### `api/internal/repository` — DB-backed, skipped in short mode

Repository tests need a live PostgreSQL and must guard with:

```go
if testing.Short() {
	t.Skip("requires a database")
}
```

CI runs `go test ./... -short`, so these run locally only. Keep them focused on SQL that
logic depends on (filters, ordering, joins) rather than re-testing pgx.

### `api/internal/handler` — thin, so test the wiring

Handlers should stay thin (validate → call service/repo → respond). Test the parts that
can actually break: status codes for bad input, authorization branches, and the shape of
the JSON response.

### `web/` — Vitest + Testing Library

Tests live next to the code as `*.test.ts(x)` and run under jsdom (`vitest.config.ts`).

Test **behaviour the user sees**, through queries a user would use — not props, not state:

```tsx
it('omits missing places when there are fewer than three participants', () => {
  render(<Podium top={[maria, joao]} />)

  expect(screen.getByText('1º')).toBeTruthy()
  expect(screen.queryByText('3º')).toBeNull()
})
```

- Build fixtures with a typed factory that takes overrides (see `Podium.test.tsx`).
- `getBy*` when the element must exist, `queryBy*` when asserting absence.
- Assertion text is the Portuguese UI copy — that is correct, it is what renders.
- Hooks: test through a component or `renderHook`, covering the URL/param edge cases
  (`useRoundInUrl.test.tsx` is the reference).
- API modules: mock `fetch`, assert the request path/body and the error mapping
  (`authApi.test.ts` is the reference).

## What not to test

Framework behaviour, generated types, trivial pass-through getters, or Tailwind classes.
A test that only restates the implementation costs maintenance and proves nothing.
