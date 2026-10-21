# Writing style

Write the prose docs in this repo in ASD-STE100 Simplified Technical English (STE), adapted. This applies to `README.md` (except its Portuguese product copy), `docs/development.md`, `ARCHITECTURE.md`, `SCORING.md`, every `AGENTS.md`, the docs under `docs/`, Linear issues and PR descriptions. Product copy in the UI stays Portuguese and does not follow these rules.

## Rules

- Write one topic in each sentence. Write one topic in each paragraph.
- Keep instructions to 20 words or fewer. Keep descriptions to 25 words or fewer.
- Keep paragraphs to 6 sentences or fewer.
- Use the active voice. Write instructions in the imperative: "Run `npm test`.", not "You should run `npm test`."
- Use one word for one meaning. Use the terms in the [glossary](#glossary) for the concepts it names.
- Use a simple verb, not a phrasal verb or an idiom: "remove", not "get rid of".
- For a rule, write "do" or "do not". Do not write "should", "may" or "might" for a rule.
- Use a numbered list for steps. Use a bulleted list for conditions.
- Put a warning before the step that it applies to.
- Do not change code, commands, paths or identifiers. Write them exactly, in backticks.

## Glossary

| Term | Meaning |
|---|---|
| **bolão** | One season of the pool (`boloes` table). Exactly one is active. A finished bolão is read-only. |
| **round** | A matchday (`rodada`). Players predict per round. |
| **match** | One game in a round, with a home and an away team. |
| **prediction** | A player's predicted score for a match (`palpite`). |
| **market** | The prediction window of a match. It closes at `market_closes_at`. |
| **close time** | The time a round closes: the earliest market close of its matches. |
| **partials** | Live in-progress scores (`parciais`), used for provisional standings. |
| **classification** | The standings, cumulative or for one round. |
| **participant** | A user who plays in a bolão (`bolao_participants`). |
| **admin** | A user with `is_admin`. Admins write matches, results and bolões. |
| **reminder** | A push notification for a round: new round, day before or ten minutes before. |
| **tick** | One call of the cron job to `/api/internal/notifications/tick`. |
| **dev** | The staging environment. `main` deploys to it. |
| **prod** | The production environment. A `v*` tag deploys to it. |
