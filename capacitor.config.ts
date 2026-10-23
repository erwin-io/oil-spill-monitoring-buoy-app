import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "com.oilspillmonitoringbuoy.app",
  appName: "Oil Spill Monitoring Buoy",
  webDir: "www",
  plugins: {
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
};
export default config;
