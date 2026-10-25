# BlueGuard Phase 2 — Firebase Hosting verified Android action links

**Only Host:** `oil-spill-monitoring-buoy.firebaseapp.com` from the existing Firebase project. Android package remains `com.oilspillmonitoringbuoy.app`. These links do not implement passwordless login, grant ownership, or bypass verified-email Firebase session authorization.

## Before publishing
1. On a Windows development PC, clone **API and mobile as sibling directories**, run `npm ci` in both.
2. In API `.env`, enter `P2_APP_LINK_HOST=oil-spill-monitoring-buoy.firebaseapp.com`, `P2_ANDROID_SHA256` set to the actual certificate fingerprint for **the installed APK**. Debug and release fingerprints are different; include each approved signing certificate when needed.
3. Run `npm run verify:p2` inside API. It writes `api/.test-output/p2-gates/assetlinks.json`, validates live Hosting if already published, builds an invitation example and produces JSON/Markdown report. **No Hosting deploy is automatic.**
4. After review, copy that generated `assetlinks.json` to `mobile/hosting/public/.well-known/assetlinks.json`, which must be served with HTTP 200 and `application/json` at the HTTPS URL. Do not deploy an empty or placeholder file. If multiple APK signing certificates are needed, include their fingerprints in an approved file.
5. From the **mobile** root with official Firebase CLI and credentials, deploy *only* after production Hosting review: `npx firebase-tools deploy --only hosting --project oil-spill-monitoring-buoy`. **This publishes to the existing project's site**; it is not part of the noninteractive test script.
6. On the installed Android APK, confirm matching certificate: `keytool -list -v -keystore <your-debug-or-release-keystore>` or `apksigner verify --print-certs app-debug.apk`; then `adb shell pm verify-app-links --re-verify com.oilspillmonitoringbuoy.app`, `adb shell pm get-app-links com.oilspillmonitoringbuoy.app`.
7. Send a test link in Gmail (P2-15 email provider is separately configurable) and **tap the link**. Confirm it opens BlueGuard rather than a browser. Sign out and re-open: link should present Login; sign in as invited verified account, open My Buoys, accept invitation. An outsider must not gain access.

## Important implementation details
- Native MainActivity catches only HTTPS `/open/invite` and `/open/transfer` on the approved Firebase domain. It queues the URL before Angular initialization and dispatches a WebView event. No additional Capacitor plugin or changes to existing Google sign-in.
- Angular strictly parses the host/path, accepts **only one safe buoy ID query parameter**, then routes to the authenticated My Buoys screen where current pending invitation/transfer is fetched from API.
- Email links are invitations/navigation, **not** Firebase Auth's passwordless Email Link Sign-In API, and not old Firebase Dynamic Links.
- The fallback page is static and does not attempt insecure auto-login, auto-accept, or parse secrets.
- Physical Gmail tap, verified Android certificate, installed APK and real backend account/Viewer acceptance require user acceptance evidence. A CI APK build alone is not such evidence.
