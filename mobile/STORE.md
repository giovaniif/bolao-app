# Store listings

This file gives the App Store and Google Play answers for the mobile app, and the steps that only the owner can do. Issue: #87.

## Listing metadata

[`store.config.json`](store.config.json) holds the App Store listing in the [EAS Metadata](https://docs.expo.dev/eas/metadata/) format: name, subtitle, description, keywords, promotional text, URLs, category, age rating answers, review contact and review notes, in `pt-BR` (primary) and `en-US`.

- The privacy policy, the terms of use and the support page are `https://bolao.giovani.app/privacidade` (the web route `/privacidade`). Release the web before you push the metadata, so the URL works when Apple checks it.
- The file has placeholders. Replace them before the push, and do not commit real values:
  - `review.demoUsername` and `review.demoPassword`: a demo account on the **production** API that is a member of a bolão with open and closed rounds.
  - `review.phone`: a real phone number.
  - `review.email` and the contact on the privacy page: `suporte@giovani.app`. Make sure that this mailbox exists, or change both.
- EAS Metadata supports the App Store only. Type the Google Play listing in the Play Console. The text in `store.config.json` fits there too (Play short description: 80 characters, use the promotional text).

### Age rating and gambling

Apple can treat a prediction pool as gambling. The answers are:

| Question | Answer | Why |
|---|---|---|
| Contests | Infrequent or mild | Players compete for points and a place in the standings. |
| Simulated gambling | None | There are no casino games, odds or virtual currency. |
| Gambling (real money) | No | The app does not take, process or pay out money. There are no in-app purchases and no prizes. |
| Unrestricted web access | No | The app opens only its own pages and the API. |

Some groups agree on an entry fee outside the app, and an admin can mark who paid (`amount_paid`). That is a note only. The review notes and the privacy page say this. If a reviewer still rejects the app under guideline 5.3 (gaming, gambling and lotteries), answer that no money moves in or through the app. If necessary, hide the paid marker in the iOS app.

On Google Play, answer the content rating questionnaire the same way: no real-money gambling, no simulated gambling.

## App Store privacy label

Source: the code in `mobile/src` and `api/`. Check these answers again when you add a data flow.

Data collection: **Yes**. Tracking (across apps of other companies): **No**. No data is used for third-party advertising.

| Data type | Collected | Linked to the user | Purposes |
|---|---|---|---|
| Contact info: Name | Yes (display name) | Yes | App functionality |
| Contact info: Email address | Yes, optional (password reset) | Yes | App functionality |
| User content: Other user content | Yes (predictions, favorite team, bolões) | Yes | App functionality |
| Identifiers: User ID | Yes (username, internal id) | Yes | App functionality, Analytics |
| Identifiers: Device ID | Yes (Expo push token, only after the user allows notifications) | Yes | App functionality |
| Usage data: Product interaction | Yes, only after consent (PostHog) | Yes (`identify` with the user id) | Analytics |
| Diagnostics: Crash data | Yes (Sentry) | Yes (user id) | App functionality |
| Diagnostics: Performance data | Yes (Sentry) | Yes (user id) | App functionality |
| Diagnostics: Other diagnostic data | Yes (Sentry: device, OS, app version) | Yes (user id) | App functionality |

Not collected: location, contacts, photos, health, financial info, purchases, browsing history, search history, sensitive info, device ID for advertising.

Notes:

- Sentry runs with `sendDefaultPii: false`, and `scrubEvent` removes headers, cookies, request bodies and emails, and keeps only the user id. Sentry gets the user id, so the diagnostics rows are "Linked to the user".
- PostHog starts opted out (`defaultOptIn: false`). It sends events only after the user accepts, and the profile has a switch to stop it.
- The mobile app registers an Expo push token after the user allows notifications, and deletes it at sign out. The token is linked to the user and is used only for round reminders.
- Sign in with Apple and Google sends an ID token to the API. The API keeps the provider, the subject id and the email of the token, linked to the user.

## Google Play data safety

| Question | Answer |
|---|---|
| Does the app collect or share user data? | Yes, it collects. It does not share. (Sentry, PostHog and the hosts are service providers.) |
| Is all data encrypted in transit? | Yes (HTTPS only). |
| Can users ask to delete their data? | Yes: in the app (Perfil > Excluir minha conta) and by email. |
| Account deletion URL | `https://bolao.giovani.app/privacidade` (section "Como excluir sua conta") |

| Data type | Collected | Optional | Purposes |
|---|---|---|---|
| Personal info: Name | Yes | No | App functionality, Account management |
| Personal info: Email address | Yes | Yes | Account management |
| Personal info: User IDs | Yes | No | App functionality, Analytics, Account management |
| Device or other IDs | Yes | Yes (notifications permission) | App functionality |
| App activity: App interactions | Yes | Yes (consent) | Analytics |
| App activity: Other user-generated content | Yes (predictions) | No | App functionality |
| App info and performance: Crash logs | Yes | No | App functionality |
| App info and performance: Diagnostics | Yes | No | App functionality |

Data is processed ephemerally: No. Collection is required for the app to work: Yes, for name, user ID and predictions.

## Steps for the owner

1. Merge and release the web privacy page (`gh release create`), then open `https://bolao.giovani.app/privacidade`.
2. Make the demo account on production. Put its login, a real phone and the contact email in `store.config.json` on your machine only.
3. In `mobile/`: `npx eas-cli@latest metadata:lint`, then `npx eas-cli@latest metadata:push`. Revert the placeholders before a commit. To get the live values back: `metadata:pull`.
4. App Store Connect, by hand:
   - App Privacy: type the label above (EAS Metadata does not push it).
   - Screenshots: 6.9" iPhone (1320 × 2868 or 1290 × 2796) is required. 6.5" (1284 × 2778 or 1242 × 2688) is optional. iPad is not needed (`supportsTablet: false`).
   - Price: free. Availability: Brazil (and others if you want).
   - Build: `npx eas-cli@latest build -p ios --profile production --auto-submit`. Add testers in TestFlight.
5. Google Play Console, by hand:
   - Create the app `com.giovaniif.bolao`: default language pt-BR, app, free.
   - Store listing: name, short description (≤ 80 characters), full description, icon 512 × 512, feature graphic 1024 × 500, 2 to 8 phone screenshots (16:9 or 9:16, each side 320 to 3840 px).
   - App content: privacy policy URL, ads (no), app access (the demo account), content rating questionnaire, target audience (18+ or 13+; not for children), data safety (the table above), news app (no).
   - Make a Google Cloud service account key with Play access for `eas submit`, and set it as `submit.production.android.serviceAccountKeyPath` in `eas.json` (do not commit the key).
   - The first upload must be by hand: `npx eas-cli@latest build -p android --profile production`, then upload the `.aab` to the **Internal testing** track. After that, `eas submit -p android` works.
   - A new personal developer account must run a closed test with 12 testers for 14 days before production access.
