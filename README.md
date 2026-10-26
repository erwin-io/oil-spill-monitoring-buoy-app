# Oil Spill Monitoring Buoy Mobile — Ionic Angular (Phase 1)

The project uses **Angular 20**, **Ionic 8**, **Capacitor 7**, and **Firebase JS SDK 12**. It uses the **Email/Password** provider for Phase 1; native and browser Google Sign-In are deliberately disabled until they can be independently configured and verified.

## Windows development

Use Node **20.19+**, **22.12+**, or **24+** (a version supported by Angular 20).

```powershell
node --version
npm --version
npm ci
npm test
npm run check
npm start
```

The repository commits `package-lock.json`. Use `npm ci` to install exactly the resolved dependency tree, and do not use `--force` or `--legacy-peer-deps` to bypass peer dependency conflicts.

## Firebase setup

- Enable Firebase **Email/Password** (email-link/passwordless is unnecessary).
- Register a Firebase Web App and place its public SDK configuration into **both** `src/environments/environment.ts` and `src/environments/environment.prod.ts`.
- Use your reachable Express API URL in each corresponding environment; `localhost` is not a working phone backend URL.
- Never copy Firebase Admin private keys into the mobile project.
- Google Sign-In is not implemented in this baseline; complete OAuth and native signing/SHA setup before adding it.
- Pusher client key and cluster can be configured without exposing the server's Pusher secret.

## Android identity and build

The **current, tested Android app ID** is `com.oilspillmonitoringbuoy.app` in both `capacitor.config.ts` and `android/app/build.gradle`. Register or select the Firebase Android app with this exact package name. Do **not** use the older `io.erwin.oilspillbuoy` ID; it does not match the installed APK.

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

`npm test` is a set of source-structure checks, not Firebase integration or Android tests. `npm run build` verifies Angular compilation. A GitHub Actions workflow runs `npm ci`, `npm test`, and `npm run check`; integration tests with configured Firebase/FCM/Pusher and on-device validation remain separate gates.

## Device-aware Android verification (Windows)

Run `npm run verify:local` to validate the app without a phone: this runs
Node tests, the Angular production check and the Angular web build. It never
installs an APK, selects an Android device or deploys Firebase/Vercel.

Run `npm run verify:android` in **interactive PowerShell** to run the same
checks plus Capacitor sync, a native debug APK build, device installation,
and launch smoke test. The script performs a device preflight *before* any
install, tests or build work:

- One online/authorized device in `adb devices -l`: selects it automatically
  (a real Samsung or a running Android emulator).
- More than one online device: asks which device to target; each subsequent
  ADB call uses `adb -s <chosen-serial>` to avoid affecting the wrong phone.
- No online devices: enumerates configured Android Virtual Devices using
  `emulator -list-avds`, asks you to choose one, launches the selected AVD,
  and waits for it to finish booting (up to 180 seconds).
- No configured AVDs, cancelled prompt, no interactive console, or failed
  emulator boot: aborts **before** dependencies are installed or a build begins.
  Offline and unauthorized devices are shown but are not eligible.

Prerequisites: Android SDK emulator tools and `adb` must be installed;
`ANDROID_HOME` or `ANDROID_SDK_ROOT` may point to the SDK directory. For
real-device testing, connect your phone and enable USB debugging.

`npm run verify:android -- --screenshot` also saves a private launch screenshot
in `.test-output/android-launch.png`. The locally signed debug APK may use a
different signing identity from an existing release APK; if Android reports
`INSTALL_FAILED_UPDATE_INCOMPATIBLE`, do not uninstall the release app without
planning for app data/keystore consequences. GitHub CI only compiles its own
debug APK and does not install your locally configured Firebase app.

## Android JDK 21 preflight

`npm run verify:android` selects a verified local JDK 21 for its **own process** before running npm, Capacitor or Gradle. It checks `JAVA_HOME`, `JDK21_HOME`, `JAVA21_HOME` and installed JDKs under the Windows Program Files Java, Eclipse Adoptium and Microsoft directories. It prints the selected JDK and Gradle JVM. JDK selection is temporary: it never modifies the system-wide Java configuration, local signing keys, Gradle properties, Firebase settings or the installed APK.

If Gradle still reports Java 17, inspect `android/gradle.properties` and `$env:USERPROFILE\.gradle\gradle.properties` for an `org.gradle.java.home` override or a Gradle Java toolchain override. Use `--stacktrace --info` on the failing Gradle Java task to identify its compiler if the Gradle runtime is Java 21.
