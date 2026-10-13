# web

The React PWA: TypeScript, Vite, TanStack Query and Tailwind v4. The repo-wide rules in the [root AGENTS.md](../AGENTS.md) also apply here.

## Commands

```bash
npm run lint            # eslint ., flat config in eslint.config.js
npm test                # vitest run (jsdom)
npm run test:coverage   # vitest run --coverage; enforces the coverage floor
npm run build           # tsc -b && vite build; needs VITE_API_URL
npm run dev             # proxies /api to VITE_API_URL or http://localhost:3333
```

- The dev server binds all interfaces and accepts `.ts.net` hosts (`vite.config.ts`).
- `npm run build` fails without `VITE_API_URL`, so a bundle never falls back to `/api` on the Vercel domain.
- ESLint: `@eslint/js`, `typescript-eslint`, `react-hooks` and `react-refresh`. `react-hooks/exhaustive-deps` finds real bugs. Fix the dependencies, do not silence the rule. No file-wide `eslint-disable`. The only disable that `lint-comments` passes is `// eslint-disable-next-line <rule>`.

## Layout

```
src/features/<feature>/
  api/         fetch functions and their response interfaces
  hooks/       TanStack Query hooks around those functions
  components/  presentational pieces
  pages/       route-level composition
src/shared/
  api/client.ts       the api<T>() wrapper (auth, errors, 204)
  components/         Button, Input, Layout, AppHeader, BottomNav
  hooks/              useAuth, AuthProvider, useRoundInUrl
  query/queryKeys.ts  every cache key
  utils/              date helpers
src/sw.ts             the service worker (push, notification click)
src/serviceWorker/    the worker's pure logic, with tests
src/test/setup.ts     Testing Library setup
```

Features: `admin`, `auth`, `boloes`, `champions`, `classification`, `matches`, `notifications`, `parciais`, `predictions`, `profile`, `viewPredictions`.

## Rules

- **A feature owns its vertical slice.** Cross-feature imports are fine for types and small components (`champions` imports `UserWithStats` from `classification`). If two features need the same behavior, move it to `shared/`.
- **The data path is fixed:** `api/*.ts` → `hooks/*.ts` → page → component. A component never calls `api<T>()`, and a page never calls `fetch`.
- **Server state is TanStack Query only.** Never `useState` plus `useEffect` for fetching. Every key comes from `shared/query/queryKeys.ts`: add the key there first, so invalidation stays greppable.
- **Hooks own cache invalidation:**

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

- **The URL is state.** The selected round lives in `?rodada=N` through `useRoundInUrl`, so links and reloads keep it. New cross-page selection state follows that pattern, not a context.
- API response types are `interface`s next to the function that returns them, with `snake_case` fields that match the Go JSON tags. Do not remap casing.
- No `any`. Narrow `unknown` with a type guard, as `client.ts` does with the error body.
- Function components, named exports, one component per file, PascalCase file names.
- Pages compose. Components stay presentational and take data through props.
- Tailwind utility classes inline. No CSS modules, no styled-components. Use `Button`, `Input` and `Layout` before you write a new one.
- `@` is an alias for `src/` in `vitest.config.ts`. Relative imports are the norm. Do not churn them.

## Behavior notes

- Route paths and tab values stay Portuguese (`/rodada?aba=galera`). They appear in shared links.
- The old Galera and Parciais routes redirect to the matching `/rodada` tab. `BottomNav` lights Rodada for them, so a direct link never leaves the bar with nothing active.
- `useRoundInUrl` defaults to the active round from the rounds summary. It merges into the query string, so `?aba=` survives a round change.
- `useTabInUrl` never writes on mount. Two hooks that write in the same tick overwrite each other, so only the round corrects the URL.
- `useRounds`, `useActiveRound` and `usePendingResults` share one query key. One request feeds all three, so the default round does not jump and `AdminBanner` costs no request. `useAdmin` re-exports them.
- `useSeasons` uses the same key as `useClassification(undefined, bolaoId)`. Its `staleTime` is infinite, because a finished bolão's ranking never changes.
- `RoundPage` mounts each panel on first use and then only hides it. Unmounting would discard unsaved partials and the selected player.
- In `PartialsPanel`, both sides `null` means nothing was entered. One `null` side is a team the user never tapped, which is a real 0.
- The Hall of Champions reads the season year from the bolão name, not the dates. It counts titles on the client. It computes round winners per season, because `rounds_won` skips rounds nobody scored in.
- `ChampionHero` uppercases its text in JSX, because Testing Library matches DOM text. `SeasonGallery` uses CSS uppercase, so tests find the name as the admin wrote it.
- `Avatar` hides its initials from screen readers. The wrapping link or the text beside it gives the name.
- `ChipRow` scrolls the active chip into view. jsdom has no `scrollIntoView`, so `src/test/setup.ts` stubs it.
- The API sends UTC. `shared/utils/date.ts` shows times in the device time zone and converts `datetime-local` values back to UTC ISO.
- `index.css` uses `@theme static`. Plain `@theme` removes variables used only in arbitrary values such as `bg-[var(--color-card)]`.
- `pushSupport` treats a Mac with touch as an iPad, because iPadOS reports itself as a Mac.
- On a notification click, the service worker focuses an open app tab before it opens a new window.

## PWA and push

See [ADR 0006](../docs/adr/0006-web-push-via-pg-cron.md).

- `vite-plugin-pwa` builds `src/sw.ts` with `injectManifest` and no precache, so the app never serves a stale bundle. The worker has its own `tsconfig.sw.json` (WebWorker lib), and `tsconfig.app.json` excludes it.
- `features/notifications` holds the opt-in: `pushApi.ts`, `usePushSubscription` and `PushToggle` on the profile page.
- On iOS in a Safari tab, the toggle becomes a hint to add the app to the Home Screen, because iOS has Web Push only in the installed app.
- `index.html` sets `apple-mobile-web-app-status-bar-style` to `black-translucent`. Thus top-anchored bars need the `safe-area-pt` utility.

## Tests

Tests live next to the code as `*.test.ts(x)` and run under jsdom.

- Test what the user sees, through the queries a user uses, not props or state.
- Build fixtures with a typed factory that takes overrides (see `Podium.test.tsx`).
- `getBy*` when the element must exist, `queryBy*` to assert absence.
- Assertion text is the Portuguese UI copy, because that is what renders.
- Hooks: test through a component or `renderHook`, with the URL and param edge cases (`useRoundInUrl.test.tsx`).
- API modules: mock `fetch`, assert the path, the body and the error mapping (`authApi.test.ts`).
- Do not test framework behavior, generated types, getters or Tailwind classes.

`vitest.config.ts` sets coverage `thresholds` from the measured coverage when the floor was set. `npm run test:coverage` fails when any of the four drops. Raise a threshold only when the measured number went up.
