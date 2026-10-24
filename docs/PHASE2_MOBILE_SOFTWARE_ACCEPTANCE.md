# Phase 2 — Mobile software-only acceptance (2026-10-24)

**Owner decision:** Android physical-device manual UX testing and bug filing are delegated to the owner. Code acceptance uses automated Node/Angular and native debug APK compilation; it does not assert installed-device or live-provider delivery.

## Scope of this development build
- C-26: show five most recent device-latest measurements as explicit summary cards alongside existing counters and recent alert cards; no fabricated readings.
- C-27: indicate each ACTIVE buoy's online/offline/not-yet-seen status using 60-minute lastSeenAt rule, including DISABLED state.
- C-28: display latest health washPump, samplePump, and valve observations as cleaning-operation status; use “Not reported” when data is missing.
- C-32: resolve buoy display names with ID fallback, render per-user unread from API read receipts, fetch server-filtered alert pages and Load more.
- C-37: explicit retry controls on dashboard, buoy list/detail, history, health, alert inbox/detail and configuration.
- C-38: GitHub CI builds Android debug APK with the shared codebase, without a real Google service file or attached Android phone. Do not confuse an APK build with live FCM push validation.

## Integrated contracts
- Backend PR includes GET /api/v1/alerts cursor/status/openCount/deviceName/unread and POST /api/v1/alerts/{id}/read.
- Existing Firebase project; public Firebase client configuration remains in mobile environments. No private Firebase Admin or Pusher secrets should ship to mobile.
- Pusher public key is not configured in committed environments; REST fallback runs without it. Real private-channel event delivery is not yet proven.
- Native google-services.json is git-ignored. Valid FCM background delivery, token registration on an installed device and tapping notifications remain owner/provider checks.

## Validation
- `npm run verify:local -- --skip-install` from mobile directory
- `npm run check`
- Native build: `npm run build && npx cap sync android && cd android && ./gradlew assembleDebug` (CI Ubuntu)
- When backend and mobile Phase 2 PRs are ready, owner may merge after check review; changes are not auto-merged.
