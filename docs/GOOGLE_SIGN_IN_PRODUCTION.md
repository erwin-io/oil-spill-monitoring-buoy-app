# Production Google Sign-In — Android + Web (October 2026)

This project uses the existing Firebase Auth project `oil-spill-monitoring-buoy` and the same server-authoritative `POST /api/v1/auth/bootstrap` for both authentication providers. Email/Password is kept intact. Google login requests only basic identity (openid, email, profile); the app does NOT request Gmail, Contacts or Drive permissions.

## Native Android setup
- Firebase Console > Authentication > Sign-in method: enable Google and preserve Email/Password.
- Google Auth Platform > Audience: External, In production. Branding verification is still a separate Google policy requirement; publishing status is not proof of verification.
- Project Settings > Your Android apps: package `com.oilspillmonitoringbuoy.app`. Register SHA-1 and SHA-256 of the **debug** signing certificate. Also register the release/signing-certificate SHA-1 and SHA-256 for each actual production APK; if Google Play re-signs the app, register the **Play App Signing** certificate too.
- After fingerprints are saved, download the latest Android `google-services.json` and place it at `android/app/google-services.json`. **Do not commit the file.** The real file on the operator's machine is required for Google account selection.
- Plugin: `@capacitor-firebase/authentication@7.5.0`, paired with Firebase JS `11.10.0` for valid peer dependency alignment and Capacitor 7. Android `rgcfaIncludeGoogle = true`, `androidxCredentialsVersion = '1.3.0'`; native `skipNativeAuth:true` so only the Firebase JS SDK owns the session.
- `npm ci && npm run check && npx cap sync android && npx cap open android`. Gradle builds from Android Studio or `cd android && .\gradlew.bat assembleDebug` on Windows.
- Google identity token from the native account chooser is exchanged for a Firebase JS credential via `GoogleAuthProvider.credential` and `signInWithCredential`; **the backend always receives a Firebase ID token**, never a raw Google ID token.

## Browser setup
- Firebase Authentication > Settings > Authorized domains: add the actual deployed web domain where Google popup login is offered. Use `localhost` for development (modern Firebase projects may require manually adding it). Google popup on an arbitrary LAN IP/non-HTTPS origin may fail; prefer `http://localhost:8100` or a configured HTTPS hostname.
- Google popup login uses Firebase `signInWithPopup` and `GoogleAuthProvider`, and then the same `/auth/bootstrap`. Pop-up blockers and unapproved domains surface actionable errors.
- Native Android must be built/synced; browser `ng serve` cannot exercise the native account chooser.

## Scope and validation
- Google users need a verified email and receive the API's normal default VIEWER role with **no automatic buoy assignments**. Same UID and role enforcement as Email/Password. Admin/Operator roles cannot be granted by the client.
- Unit tests cover native/web paths, missing token/plugin, Firebase ID token exchange, rejected identity mismatch, session invalidation, and preserved Email/Password.
- CI checks build the Angular app and a debug APK without the real Google credential/service file. Neither emulator tests nor APK compilation prove live Google provider sign-in.
- Owner handles real-device bug reporting; first live Google login must be checked once with the registered signing fingerprint. Do not mistake OAuth Branding approval for Auth provider being enabled.
