# BlueWatch Mobile — Ionic Angular Standalone (Phase 1 source)

The current project is a new **standalone Angular 20 + Ionic 8 + Capacitor 7** foundation built against the Oil Spill Monitoring Buoys October 2026 technical handoffs. Page templates and styling are separate from each page's TypeScript; application services and domain models are in `src/app/core`. The app intentionally excludes GPS/maps and all automatic after-filter measurements.

## Windows quick start

```powershell
npm install
# Fill Firebase Web app config into both src/environments/environment.ts and environment.prod.ts
npm test
npm run build
npx ionic serve
```

For Android:

```powershell
npm run build
npx cap add android
# Place Firebase Android config into android/app/google-services.json and finish Gradle plugin integration
npx cap sync android
npx cap open android
```

The official Angular project name in `angular.json` is `app`, matching `ionic.config.json`. `capacitor.config.ts` uses `webDir: 'www'`.

**Known acceptance limits:** UI is an uncompiled scaffold until npm dependencies are installed and `npm run build` / Ionic serve pass. Native Android project must still be generated, configured and built locally. Browser Firebase config and backend credentials are user-owned and not included. Real FCM and native Google sign-in require Android-owner validation; they are not proved by structural tests. Chart screen renders the most recent 100 records and does not yet support a comprehensive selectable date-window / pagination contract.

Use `../api/docs/FIREBASE_WINDOWS_SETUP.md` for the detailed Firebase, Pusher, Node, Android and Vercel setup guide.
