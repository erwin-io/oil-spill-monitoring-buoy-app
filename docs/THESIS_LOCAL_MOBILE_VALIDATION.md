# Thesis Android testing — automated first, five manual acceptance checks
**Firebase:** same existing thesis project for Android; **no second Firebase project needed**. Tests never seed synthetic oil telemetry into the real project.

## Command 1: No Android SDK or device required
Requirements: Node.js 22+ / npm.
```powershell
cd C:\Development\oil-spill-monitoring-buoy\oil-spill-monitoring-buoy-app
git fetch origin
git switch fix/phase1-push-session-race
git pull --ff-only
npm run verify:local
```
This runs `npm ci`, Node mobile tests, production Angular compile and Angular build, failing immediately on any red step. These tests include real service-level TypeScript logic with mocked Firebase/Pusher callbacks: session/account switching, FCM token renewal/logout races, Pusher reconnect/fallback, API request route+cursor contracts, config/alerts permissions path and five Chart.js telemetry metric mappings. These are automated functional/contract checks, **not** rendered-device screenshots or real FCM delivery.

`npm run verify:local -- --skip-install` reuses `node_modules`. Report: `.test-output/mobile-local-validation.json` (ignored by git).

## Command 2: Native Android build + install + launch
Requirements: Android Studio with Android SDK, Android SDK Platform Tools `adb` on PATH, Java JDK matching the Capacitor Gradle project, one USB-debugging authorized Android phone, and the Firebase Android `google-services.json` kept PRIVATE in `android/app/`.

Check that `environment.prod.ts` points to the HTTPS API used with your **existing** Firebase project (the code is already configured that way), and that `google-services.json` has the same projectId and package `com.oilspillmonitoringbuoy.app`.

```powershell
adb devices
npm run verify:android
```

The runner repeats automated unit/contract/Angular checks, then validates package/config identity, runs `npx cap sync android`, `android\gradlew.bat :app:assembleDebug --no-daemon`, checks the resulting APK, uses `adb install -r`, launches the package and verifies that its process remains alive. It returns nonzero on a failed stage.

Optional private launch screenshot (can contain user information, never share unredacted):
```powershell
npm run verify:android -- --screenshot
```
Outputs: `.test-output/mobile-local-validation.json` and optionally `.test-output/android-launch.png`. No Firebase user credentials or real FCM token is required for a build/launch smoke check. Passing does **not** mean Firebase sign-in or FCM delivery succeeded.

When Android Studio/SDK is not installed, use Command 1 only. If the app needs network access to `http://localhost:3000`, note that the phone's localhost is NOT your Windows PC. Prefer the existing HTTPS API. This runner requires HTTPS in `environment.prod.ts`.

## Five remaining manual tests on the REAL phone
These remain because Node-based mocks, Gradle and ADB process checks cannot prove what a person sees in the installed app.

1. **Authentication and access:** Register/verify one Firebase Email/Password account (or use an existing verified user); sign in, restart app, logout, test assigned vs unassigned buoy. Confirm user role/data is not carried across account switching.
2. **Data-driven screens:** With existing legitimate data or explicitly owner-approved test telemetry, compare one buoy's Overview, Detail, History, Trends, Health, Alerts and Config screens with actual API responses. If the account has no assigned buoy, label these tests **BLOCKED/NO DATA**, not PASS.
3. **Config and acknowledgment permission:** Operator (if provisioned) may edit an assigned buoy config and acknowledge a test alert; Viewer may only read. Do not modify a real active monitoring buoy for a test without approval.
4. **Pusher realtime/recovery:** Set the public Pusher client key and cluster in both mobile environments and enable the corresponding backend provider. While Overview is open, use an authorized, safe test event to verify server event publication, private subscription, REST reconciliation and reconnect. Without provider credentials label **NOT RUN** rather than PASS.
5. **FCM notification and logout:** Allow notifications, check for active token in the same project's `notificationTokens` (no raw token export). Observe foreground and background delivery, tap opens correct alert, then logout deactivates token. Actual test alert should be a controlled thesis test event, not a fabricated real spill report. If no safe test event is available label **NOT RUN**.

## Recording acceptance
For each manual test capture: app branch/head, Android version, result PASS/FAIL/BLOCKED, screenshot only if redacted, matching API measurement/health/alert ID, any relevant Logcat message after redacting secrets. Do not upgrade C-33 or C-38 just because `verify:android` passes.

See API documentation: `oil-spill-monitoring-buoy-api/docs/THESIS_ONE_FIREBASE_TESTING.md`.
