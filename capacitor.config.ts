import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "com.oilspillmonitoringbuoy.app",
  appName: "Oil Spill Monitoring Buoy",
  webDir: "www",
  plugins: {
    // The native SDK only presents Google account selection; the WebView's
    // Firebase JS session is established from its returned Google credential.
    FirebaseAuthentication: { skipNativeAuth: true, providers: ["google.com"] },
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
};
export default config;
