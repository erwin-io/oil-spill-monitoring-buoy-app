# P2-15 — Firebase Authentication email return to BlueGuard

## What the owner's October 25 Android test established

The installed `com.oilspillmonitoringbuoy.app` APK has an Android-verified app link for `oil-spill-monitoring-buoy.firebaseapp.com`, and `/open/invite?deviceId=TEST_BUOY` launches the installed app. The actual registration email shown in Gmail was `/__/auth/action?mode=verifyEmail&oobCode=...`, which correctly opened Firebase's browser-hosted email verification widget and successfully marked the email verified. The old app build did not have a return destination.

## Implemented design: Firebase web-first, Android app after action

- `AuthService.register`, `resendVerification`, `resetPassword` supply `ActionCodeSettings` with `handleCodeInApp:false`, the app's Android package name, and a **token-free** HTTPS continue URL:
  - Verification → `https://oil-spill-monitoring-buoy.firebaseapp.com/open/email-verified`
  - Password reset → `https://oil-spill-monitoring-buoy.firebaseapp.com/open/password-reset-complete`
- Firebase's default `/__/auth/action` page continues to process the one-time `oobCode` for email verification or to render the password reset form. **Do not route or intercept `/__/auth/action` in Android.** Do not process an action code in Javascript inside an unsafe WebView.
- A post-action Continue/Open App link can then invoke Android's already-verified `/open/` intent filter. `MainActivity` passes only the two extra routes to Angular, without Firebase action codes.
- On `/open/email-verified`, Angular calls `AuthService.reloadVerified()` against Firebase (force-refreshed ID token) and only enters authenticated tabs after a verified Firebase session/API bootstrap. If the original registration session is missing or status remains unverified, show Login/Check Verification rather than trusting link text.
- On `/open/password-reset-complete`, Angular navigates to Login. The new password is entered in Firebase's browser-based reset form, never in app-link parameters.
- `hosting/public/index.html` is a safe fallback for devices where app association isn't available. It does **not** itself complete email actions.

Official implementation reference: https://firebase.google.com/docs/auth/web/passing-state-in-email-actions — web-first `handleCodeInApp:false`, `ActionCodeSettings.url`, Android package name, and continuation. Firebase Dynamic Links are **not** used.

## Important: this new code only affects NEW email links

An email sent **before installing this version** will still contain the old `/__/auth/action` URL without the return destination. Generate a fresh verification/reset email from the updated Android build.

## Owner's local Android acceptance

```powershell
cd C:\Development\oil-spill-monitoring-buoy\oil-spill-monitoring-buoy-app
git switch main
git pull --ff-only
npm ci
npx ionic build --prod
npx cap sync android
npx cap open android
```

Install the rebuilt APK onto the existing Android phone via Android Studio; the verified signing certificate must remain the same as the one published at `/.well-known/assetlinks.json` (recheck `adb shell pm get-app-links com.oilspillmonitoringbuoy.app`).

After source review/Hosting approval, deploy the **optional updated browser fallback copy** to the existing Firebase Hosting project from this mobile root with `npx firebase-tools@15.9.0 deploy --only hosting --project oil-spill-monitoring-buoy`. This is a live Hosting deploy; **not** automatic or implied by the source-code merge.

Acceptance matrix:

| Test | Expected |
|---|---|
| Existing verified `/open/invite?deviceId=TEST_BUOY` ADB link | Still opens My Buoys |
| New registration, open Gmail `/__/auth/action` | Firebase browser widget verifies email (not the app) |
| Firebase browser widget's **Continue** / return control | Opens installed BlueGuard if Android/browser permits link handoff |
| BlueGuard receives `/open/email-verified` | Reloads actual Firebase account, initializes API account, or shows verification/login fallback |
| Request password reset from updated app, Gmail tap | Firebase browser reset form opens; securely updates password |
| After reset, Continue to `/open/password-reset-complete` | BlueGuard Login; user signs in with NEW password |
| Replay of `/open/email-verified` without Firebase verification | Cannot grant verified access |
| Any `/open/` URL with `oobCode`, `email`, `success=true` | Rejected |
| Logout, stale link, different device | No automatic login or authorization |

**Important UX caveat:** A browser may choose to remain on a same-site HTTPS link instead of dispatching an installed app despite successful Android domain verification. Firebase's default hosted email-action widget is provider-owned and cannot be altered by our Angular code. If the actual Samsung Browser user test doesn't display a Continue button, or doesn't open the app on tapping it, implement a **separate reviewed custom web email-action handler** (Firebase Authentication → Templates → customize action URL) with a clearly labeled Open BlueGuard button. This requires another separately approved Hosting deployment and template configuration change; do not claim automatic app return until real-phone Gmail acceptance passes.

P2-15 registration/reset return **pending real Android/Gmail test**; ADB domain-association results alone aren't enough.
