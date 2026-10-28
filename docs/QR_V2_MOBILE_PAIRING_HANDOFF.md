# BlueGuard Buoy — QR v2 Mobile pairing handoff

This implementation follows the synchronized [API QR v2 contract](https://github.com/erwin-io/oil-spill-monitoring-buoy-api/blob/main/docs/QR_V2_DEVICE_PAIRING_CONTRACT.md), [API issue #14](https://github.com/erwin-io/oil-spill-monitoring-buoy-api/issues/14) and [mobile issue #17](https://github.com/erwin-io/oil-spill-monitoring-buoy-app/issues/17).

## User flow
1. Signed-in user opens **My Buoys → Add Device** (existing full-screen modal, blue header, close button).
2. Taps **Scan QR Code**. Native scanner only; no user-entered device ID or claim-code bypass.
3. Scan must decode exactly `{"v":2,"deviceId":"BG-000124"}`. ID can be any registered `^[A-Za-z0-9_-]{1,80}$`. Any extra fields, plaintext device keys or old `v:1` label are rejected.
4. App sends authenticated `POST /api/v1/devices/BG-000124/pair-intents` with body `{}`, gets `intentId,state,expiresAt` and displays selected ID and **Press PAIR on your BlueGuard Buoy**.
5. User presses the physical button. Trusted ESP32-S3 firmware (not this app) must send `POST /api/v1/device/pairing-challenges` with `{"protocol":2}` authenticated using its existing long-term `X-Device-ID`/`X-Device-Key` over Smart LTE and verified HTTPS. Device then confirms the returned nonce via `POST /api/v1/device/pairing-confirmations` with `{protocol:2,intentId,challengeId,nonce}`.
6. App polls the scoped authenticated `GET /api/v1/devices/:deviceId/pair-intents/:intentId` every 2.4 seconds (4.5s after transient network error). Only state **CONFIRMED** triggers bootstrap refresh, authoritative My Buoys refresh, full-screen modal dismissal and navigation to the corresponding buoy detail.

No phone-to-buoy Wi-Fi, AP, BLE or local HTTP server. Do not claim this flow has been validated on real LTE hardware until the Device Agent adds physical-button support and records bench evidence.

## UI states / terminal behavior
| API state | Mobile behavior |
|---|---|
| WAITING_FOR_PAIR | Show selected buoy and physical PAIR instructions |
| PENDING | Show Connecting and confirming |
| CONFIRMED | Update authorized device list then open the newly owned buoy |
| EXPIRED | Stop polling, offer Retry |
| CONFLICT | Stop polling, explain ambiguous attempt and offer retry after cancellation |
| CANCELLED | Stop polling, do not grant ownership |
| ALREADY_OWNED | Direct to current-owner transfer process; no takeover |
| HTTP 401/403/404 | Stop polling and explain unauthorized/unavailable session |
| HTTP 429 / 5xx / offline | Back off and retry only during original five-minute expiry; never invent success |

Close, backdrop dismissal and destroy invalidate the generation token so stale network responses cannot navigate or update the wrong account. When authorized, `DELETE /pair-intents/:intentId` revokes the server attempt. On account switch the local generation is invalidated, and the remote intent expires if Firebase tokens are no longer usable. Retry attempts first cancel the previous ID. Do not automatically extend the five-minute server deadline.

## Files and tests
- `src/app/core/pairing-code.ts`: strict QR v2 public-ID parser.
- `src/app/core/api.service.ts`: `PairIntent` / `PairState` and three v2 user-authenticated API methods.
- `src/app/pages/add-device.page.ts`: scanner → intent → polling → confirmed navigation, race cancellation.
- `src/app/pages/add-device.page.html` / `.scss`: claim-code form removed, original BlueGuard full-screen design preserved.
- `tests/pairing-code.test.mjs`: correct QR, rejects malformed/legacy/secret-bearing labels.
- `tests/api-contract.test.mjs`: exact paths, POST body and DELETE contract.
- `tests/add-device-pairing.test.mjs`: confirmed-only navigation, cancel, delayed responses, account switch, conflict and reconnect.
- `tests/ui-refresh.test.mjs`: existing full-screen modal integration assertion updated.

## Legacy migration and safe rollback
The new Android build accepts QR **version 2 only**. Existing released mobile/firmware clients use v1 code-based `/claims` and pairing endpoints. The API keeps legacy **v1 routes active and isolated**; v2 and v1 cannot pair the same buoy simultaneously. Previously provisioned buoys must have a new QR v2 label (public Device ID only) and upgraded firmware before they can complete new QR-only onboarding. Existing device IDs, upload credentials, current owners, telemetry, alerts, sharing and transfer records are not deleted or changed by the client. Roll back to the earlier signed mobile build if necessary; do not clear cloud owner records or rotate secrets as a workaround.

## Security / firmware boundary
The QR is **public**. Its possession does not prove phone proximity and even a sole authenticated intent might have been planted remotely before the real button press. The API aborts conflicting accounts, uses rate limits, five-minute expiry and a device nonce, but cannot cryptographically attest proximity. The Device Agent must enforce a real GPIO PAIR press and never expose the long-term upload key in QR, logs, HTTP UI or Bluetooth. Future stronger proximity proof requires explicit owner decision. Do not claim this security gap eliminated solely by software.

## Test commands
From mobile repo: `npm test`, `npm run check`, `npx cap sync android`. CI compiles Android debug APK. A real installed-device acceptance test requires LTE pairing-capable firmware and is **not** equivalent to the emulator and test-harness results.

No firmware source was edited by this mobile handoff. The phone never sends its own physical PAIR event to the API.
