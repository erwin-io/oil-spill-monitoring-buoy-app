# BlueWatch Mobile — Ionic Angular (Phase 1)

The project uses **Angular 20**, **Ionic 8**, **Capacitor 7**, and **Firebase JS SDK 12**. It uses the **Email/Password** provider for Phase 1; native and browser Google Sign-In are deliberately disabled until they can be independently configured and verified.

## Windows development

Use Node **20.19+**, **22.12+**, or **24+** (a version supported by Angular 20).

```powershell
node --version
npm --version
npm install
npm test
npm run build
npm start
```

The first successful `npm install` produces `package-lock.json`; commit the generated lockfile to source control so future installations use `npm ci`. Do not use `--force` or `--legacy-peer-deps` to bypass conflicts. CI also uploads its generated lockfile as a build artifact for review.

## Firebase setup

- Enable Firebase **Email/Password** (email-link/passwordless is unnecessary).
- Register a Firebase Web App and place its public SDK configuration into **both** `src/environments/environment.ts` and `src/environments/environment.prod.ts`.
- Use your reachable Express API URL in each corresponding environment; `localhost` is not a working phone backend URL.
- Never copy Firebase Admin private keys into the mobile project.
- Google Sign-In is not implemented in this baseline; complete OAuth and native signing/SHA setup before adding it.
- Pusher client key and cluster can be configured without exposing the server's Pusher secret.

## Android identity and build

The intended app ID is `io.erwin.oilspillbuoy`, matching the older working Ionic project. Confirm that ID before registering the native Android app in Firebase.

```powershell
npm run build
npm run android:init
# Put your Firebase Android configuration into android/app/google-services.json
# Complete Android Gradle Google Services/FCM wiring before real push testing
npm run android:sync
npx cap open android
```

Angular emits web assets directly into `www`; Capacitor is configured with `webDir: 'www'`.

## Validation policy

`npm test` is a set of source-structure checks, not Firebase integration or Android tests. `npm run build` verifies Angular compilation. A GitHub Actions workflow runs `npm install`, `npm test`, and `npm run build`; integration tests with configured Firebase/FCM/Pusher and on-device validation remain separate gates.
