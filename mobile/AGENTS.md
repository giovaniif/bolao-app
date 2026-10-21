# mobile

The native iOS and Android app: Expo (SDK 58), Expo Router, React Native, TanStack Query. The repo-wide rules in the [root AGENTS.md](../AGENTS.md) also apply here.

## Expo changes often

Expo ships breaking changes in each SDK. Before you use an Expo, EAS or React Native API:

1. Read the major version of `expo` in `package.json`.
2. Read the docs for that version: `https://docs.expo.dev/versions/v<major>.0.0/`.
3. For other topics, start at `https://docs.expo.dev/llms.txt`. Do not write Expo code from memory.

## Commands

```bash
npm run lint            # expo lint
npm run typecheck       # tsc --noEmit
npm test                # jest with the jest-expo preset
npx expo install <pkg>  # add a package; it picks the version that matches the SDK
npx expo start          # dev server; open it in Expo Go or a development build
npx expo-doctor         # find dependency and config problems
```

- Add packages with `npx expo install`, not `npm install`.
- `EXPO_PUBLIC_API_URL` sets the API. Without it, the app uses the dev API (`https://bolao-app-dev.onrender.com/api`).

## Layout

```
src/app/          routes (Expo Router): every file is a screen, _layout.tsx is a navigator
src/api/          api<T>() and the fetch functions, with interfaces that match the Go JSON
src/auth/         the session (token in expo-secure-store) and the login and sign-up screens
src/notifications/ Expo push: permission, token registration, tap handling (PushGate)
src/test/         render helpers for tests
jest.setup.ts     mocks of native modules for jest
```

## Rules

- Keep non-route code out of `src/app/`.
- API interfaces use the `snake_case` names of the Go JSON tags. Do not remap them.
- Keep the token in `expo-secure-store`, never in AsyncStorage.
- Server state is TanStack Query only, as in `web/`.
- Do not create or edit `ios/` or `android/`. Expo generates them from `app.json` and config plugins.
- UI text is Portuguese. Code, tests and comments policy follow the root rules (no comments).

## Push notifications

- `PushGate` (in the `(app)` layout) registers the device after login. It asks for permission once per install (`push-asked` in secure store) and posts the Expo push token to `POST /api/push/expo-tokens` with the EAS `projectId` from `app.json`.
- `signOut` deletes the token from the API before it clears the session, so the device stops getting the previous user's reminders.
- A tap on a notification opens Palpitar. Push needs a development or store build: Expo Go cannot receive remote push. `expo-notifications` is a native module, so adding or changing it needs a new EAS build.

## Builds

EAS builds and submits the app (`npx eas-cli@latest build`, `submit`). The owner's Expo account and the Apple and Google store accounts sign the builds. See issue #87.
