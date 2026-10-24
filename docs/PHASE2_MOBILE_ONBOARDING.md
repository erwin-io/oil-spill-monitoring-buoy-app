# BlueGuard Buoy Phase 2 mobile onboarding slice

This draft depends on API draft PRs #5 (pairing) and #6 (owner/Viewer authorization). It is not a production migration or Android acceptance certificate.

## Protected QR and PAIR

The protected internal label contains JSON with exactly `v:1`, `deviceId` and `claimCode`. It never contains the device HTTPS upload key. The Android QR scanner uses the Capacitor 7 compatible `@capacitor-mlkit/barcode-scanning` plugin. Its ready-to-use interface needs the Google Barcode Scanner module; the screen requests setup if missing and offers protected manual entry. Actual camera and module behavior on the target handset still require installed-device tests.

After the physical buoy enters PAIR mode, the signed-in phone submits the claim code. The server chooses the current five-minute device-authenticated challenge and returns a challenge ID; the phone polls only that challenge. The buoy must confirm it. On confirmation, the app refreshes its Firebase-backed profile before navigating to the device. The code is cleared from the screen after submission or on leave. Cancel/retry and account-switch behavior need real Android checks; mobile code is not proof that firmware has a separate PAIR button.

## Consumer navigation

- A zero-access Overview explains Add Device and invitations, and does not fetch alerts or show prior-account readings.
- My Buoys groups API-reported `OWNER` and accepted `VIEWER` access; invitations require explicit acceptance. Existing legacy entries are visibly transitional until authorized clean re-provisioning.
- Owner can invite a verified account from buoy detail. Viewer can read data but the configuration and acknowledgment controls use per-buoy access, not the old global role.
- Product-facing BlueGuard Buoy label changed. Android package `com.oilspillmonitoringbuoy.app`, Firebase project and repository names remain stable.

This slice has Node tests and an Angular production build; installed Android QR scanning, live backend contract, physical PAIR confirmation, FCM, Pusher, profile changes, app-first action links, ownership transfer and full notifications UX remain separate acceptance items. Do not mark P2-08–10 complete from this branch alone.
