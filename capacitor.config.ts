import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "com.bluewatch.monitoring",
  appName: "BlueWatch",
  webDir: "www",
  plugins: {
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
};
export default config;
