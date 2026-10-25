# BlueGuard P2-15 — Reliable Firebase email action + explicit Open App

## Observed Android acceptance failure (Oct 25, 2026)

Owner's real Samsung/Gmail recording `Screen_recording_20261025_194622.mp4`:
1. Gmail opens Firebase Auth verification email action in an in-app browser.
2. Firebase shows **Your email has been verified**; account verification SUCCEEDS.
3. Owner taps **CONTINUE**; browser displays **The operation is not valid** rather than launching BlueGuard.
4. Previously confirmed `adb shell am start -a android.intent.action.VIEW -d https://oil-spill-monitoring-buoy.firebaseapp.com/open/invite?deviceId=TEST_BUOY` correctly launches the Android app; domain appears **verified** in `adb shell pm get-app-links`.

This is the default Firebase browser handler's CONTINUE/redirect failure, not an invalid app signing fingerprint or a failed verification.

## Design change

Use Firebase's documented **custom web email-action handler** for `verifyEmail`, `resetPassword`, `recoverEmail`. Server-side Firebase Auth still validates/consumes every one-time action code; an Android App Link never grants verification/authorization.

- Static Hosting handler URL: `https://oil-spill-monitoring-buoy.firebaseapp.com/auth/action`
- Source: `hosting/public/email-action.html` and `firebase-email-action.mjs`, `firebase-email-action-core.mjs`
- Hosting rewrite handles **only** `/auth/action`. Never intercept reserved `/__/auth/action`; never intercept `/open/**` inside the email handler.
- Sensitive code is parsed and removed from browser URL immediately; it is never embedded in an app link, browser fallback URL, page text, diagnostic output or Firestore.
- `verifyEmail`: `checkActionCode` → user taps **Verify email** → `applyActionCode` → success → **Open BlueGuard Buoy**.
- `resetPassword`: `verifyPasswordResetCode` → two matching password fields → `confirmPasswordReset` → success → **Open BlueGuard Buoy** (Login).
- `recoverEmail`: `checkActionCode` → explicit restore → `applyActionCode` → success → Login. This exists because Firebase's template action handler configuration may apply to all user-management emails.
- Button uses a **real user-activated Android `intent://` URI** with explicit `package=com.oilspillmonitoringbuoy.app`, HTTPS scheme and safe browser fallback. A separate plain HTTPS link allows fallback for non-Android/unsupported browsers. Chrome documents intent URIs and requires user gesture: https://developer.chrome.com/docs/android/intents
- Android and Angular already support safe `/open/email-verified` and `/open/password-reset-complete` from Mobile PR #5 (merged). Angular reloads Firebase verification rather than trusting the link; password reset always returns Login.
- **No Firebase Authentication templates or deployed Firebase Hosting are changed by merging source.** Deployment and Console modification are explicit owner-controlled release operations.

## First run / release order — REQUIRED

**DO NOT switch Firebase templates before deploying/validating the new action page** or fresh emails will break.

1. From Windows PowerShell, update the mobile source:
```powershell
cd C:\Development\oil-spill-monitoring-buoy\oil-spill-monitoring-buoy-app
git switch main
git pull --ff-only
npm ci
npm test
npm run check
```
2. Confirm the **same local** `hosting/public/.well-known/assetlinks.json` is still present, with the verified Android SHA-256 fingerprint. This file was generated outside Git; it **must** still be in the local Hosting public directory before a new deploy:
```powershell
Test-Path .\hosting\public\.well-known\assetlinks.json
Get-Content .\hosting\public\.well-known\assetlinks.json -Raw | ConvertFrom-Json | Format-List
npx firebase-tools@15.9.0 hosting:sites:list --project oil-spill-monitoring-buoy
```
If the file is missing, copy the previously generated `assetlinks.json` from the API testing output to that exact directory before deployment. **Do not publish Hosting if this file is missing**—doing so may break Android verified App Links.

3. Obtain explicit owner acceptance that these Hosting files will be published to the **existing production Firebase Hosting site**, including the app-link and fallback pages. From mobile root, review what you are deploying and deploy Hosting only:
```powershell
npx firebase-tools@15.9.0 deploy --only hosting --project oil-spill-monitoring-buoy
```
4. Confirm new handler page is online with a harmless GET and returns HTTP 200:
```powershell
$r=Invoke-WebRequest 'https://oil-spill-monitoring-buoy.firebaseapp.com/auth/action' -UseBasicParsing
$r.StatusCode
$r.Content -match 'BlueGuard Buoy'
# The query-less page shows invalid-link UI. Never test using an actual oobCode pasted into terminal/logs.
(Invoke-WebRequest 'https://oil-spill-monitoring-buoy.firebaseapp.com/.well-known/assetlinks.json' -UseBasicParsing).StatusCode
adb shell pm get-app-links com.oilspillmonitoringbuoy.app
```

5. **Operator Console action (must be done after Hosting check):** Firebase Console → project `oil-spill-monitoring-buoy` → **Authentication → Templates** → edit the **Email address verification** template → **Customize action URL**, set **exact URL**:

`https://oil-spill-monitoring-buoy.firebaseapp.com/auth/action`

Also inspect **Password reset** and **Email address change/recovery** template action URL behavior. Firebase documentation warns that customizing the URL may apply across the project's email templates; the handler supports `verifyEmail`, `resetPassword`, `recoverEmail`. Do **not** change verification sender domain or action link placeholders. **Owner must approve/perform Console update.**

6. Generate a **NEW** email from the installed app. Existing emails reference the previous Firebase `/__/auth/action` handler.
   - Registration → Gmail email's actual link should now start with `/auth/action?mode=verifyEmail`.
   - On web action page, tap **Verify email**; expect **Email verified** and **Open BlueGuard Buoy** button.
   - Tap **Open BlueGuard Buoy**; expect Android BlueGuard app, then Firebase-verified account or Login as applicable. Do not expect automatic sign-in.
   - Forgot Password → Gmail should start `/auth/action?mode=resetPassword`; enter matching new password twice, tap reset, then **Open BlueGuard Buoy** → Login.
   - A reused or expired code must show a safe error and must not verify/reset anything.
   - `adb shell pm get-app-links com.oilspillmonitoringbuoy.app` must remain `verified`.
7. Preserve screenshots/video confirming **all** steps; until owner observes it, P2-15 registration/forgot-password RETURN-TO-APP remains `PENDING REAL PHONE`.

## Rollback

If the new template handler malfunctions, revert the Firebase Auth action URL to the **previous Firebase default** `https://oil-spill-monitoring-buoy.firebaseapp.com/__/auth/action` via Console (verify the actual old URL displayed in your console). This restores browser Firebase handling but the previous Continue-to-app failure may remain. The Hosting `/auth/action` page can stay published safely; it does not override `/__/auth/action`.

## Security

Do not log/copy/share `oobCode`, password, real recipient email, Firebase session tokens or full action URLs in CI/screenshots. `intent://` links are generated from hardcoded package+host+paths; never derived from an attacker-controlled `continueUrl`. User device must be Android-verified, with compatible browser Intent URI handling (Samsung Internet/Chrome behavior must be tested; no unconditional promise of auto-launch). No production Firebase Auth config changes occur from repository source alone.

Sources: https://firebase.google.com/docs/auth/custom-email-handler and https://firebase.google.com/docs/auth/web/passing-state-in-email-actions
