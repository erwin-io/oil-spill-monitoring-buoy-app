# BlueGuard Buoy — current mobile Add Device onboarding

> **Updated QR version 2.** The original 2026-10-25 QR v1 claim-code draft is superseded for new Android builds. The API retains v1 only for previously installed clients during a non-destructive cutover. See [the complete live mobile pairing contract](QR_V2_MOBILE_PAIRING_HANDOFF.md).

## Customer onboarding
- Open **My Buoys → Add Device → Scan QR Code** in the existing full-screen Ionic modal.
- Scan a QR containing **only public identity**: `{"v":2,"deviceId":"BG-000124"}`.
- App sends a Firebase-authenticated `POST /api/v1/devices/:deviceId/pair-intents` and displays **Press PAIR on your BlueGuard Buoy**.
- Trusted firmware must detect a genuine physical PAIR input, independently authenticate over Smart LTE HTTPS and confirm a server challenge/nonce; the customer never sees a claim code, device upload key, AP setup portal or modem credential.
- The app polls the exact user/device/intent until `CONFIRMED`; only then refreshes My Buoys and navigates to its device details.
- Active intents expire after five minutes, cannot grant ownership after cancellation or conflict, and do not bypass the existing one-owner and Viewer sharing policies.

## Native scanner and access boundaries
The `@capacitor-mlkit/barcode-scanning` QR scanner is available on installed Android devices. A browser-only Ionic development session displays a scanner-unavailable message rather than offering an insecure production manual Device ID bypass. Camera and barcode-module setup remain OS-dependent.

No mobile user gets device credentials; pairing status is Firebase account scoped. Absent LTE or unmodified v1 firmware, physical-device confirmation cannot complete. Real-device acceptance remains distinct from backend emulator and Angular CI results.

## Implementation references
- `src/app/pages/add-device.page.ts`, `.html`, `.scss`
- `src/app/core/pairing-code.ts`
- `src/app/core/api.service.ts`
- `tests/pairing-code.test.mjs`, `tests/api-contract.test.mjs`, `tests/add-device-pairing.test.mjs`
- [Backend authoritative contract](https://github.com/erwin-io/oil-spill-monitoring-buoy-api/blob/main/docs/QR_V2_DEVICE_PAIRING_CONTRACT.md)

**Security caveat:** Public QR identity plus PAIR cannot cryptographically prove the waiting phone is nearby. The server fails closed on observed competing intents, but a sole remote pre-intent remains a risk. See the backend contract before claiming secure physical possession.
