import { Injectable, inject } from "@angular/core";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { ApiService } from "./api.service";
@Injectable({ providedIn: "root" })
export class PushService {
  private api = inject(ApiService);
  private router = inject(Router);
  private token?: string;
  private initialized = false;
  async start() {
    if (!Capacitor.isNativePlatform() || this.initialized) return;
    this.initialized = true;
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== "granted") return;
    await PushNotifications.addListener("registration", ({ value }) => {
      this.token = value;
      void firstValueFrom(this.api.registerToken(value)).catch(() => {});
    });
    await PushNotifications.addListener("registrationError", (e) =>
      console.warn("Push registration error", e),
    );
    await PushNotifications.addListener(
      "pushNotificationActionPerformed",
      (e) => {
        const data = e.notification.data;
        const id = data?.["alertId"];
        if (typeof id === "string")
          void this.router.navigate(["/tabs/alerts", id]);
        else if (typeof data?.["deviceId"] === "string")
          void this.router.navigate(["/tabs/buoys", data["deviceId"]]);
      },
    );
    await PushNotifications.register();
  }
  async stop() {
    if (this.token)
      await firstValueFrom(this.api.unregisterToken(this.token)).catch(
        () => {},
      );
    this.token = undefined;
    await PushNotifications.removeAllListeners();
    this.initialized = false;
  }
}
