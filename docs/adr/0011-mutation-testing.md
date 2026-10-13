# ADR 0011: Mutation testing on the service rules

Status: accepted, 2026-10-13. Adapted from agent-workspace.

## Decision

- CI's `mutate` job runs `gremlins` on `api/internal/service`, the package that holds the scoring, classification, round and reminder rules.
- The job fails below an efficacy floor. The floor is the measured efficacy (83% on 2026-10-13). Raise it only when the measured number goes up, as for the web coverage floor.
- `tools/mutate` runs it with 4 workers and `--timeout-coefficient 50`.

## Why

- Coverage shows that a line ran, not that a test checks its result. A surviving mutant is a rule that no test pins.
- The scoring rules decide who wins the bolão. They are the code worth defending.

## Consequences

- Some survivors are equivalent mutants: the score-type cap (`>= 4` and `> 4` both cap at 4) and the sort of rounds with unique numbers. They lower the ceiling below 100%.
- The CSV export and the classification ordering hold most of the other survivors. Kill them before you raise the floor.
