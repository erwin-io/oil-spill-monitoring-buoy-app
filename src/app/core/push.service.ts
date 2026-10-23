import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class PushService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private token?: string;
  private initialized = false;

  private get nativePushAvailable(): boolean {
    // The Capacitor PushNotifications plugin is not implemented in browsers.
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('PushNotifications');
  }

  async start(): Promise<void> {
    if (!this.nativePushAvailable || this.initialized) return;

    this.initialized = true;
    try {
      const permission = await PushNotifications.requestPermissions();
      if (permission.receive !== 'granted') {
        this.initialized = false;
        return;
      }

      await PushNotifications.addListener('registration', ({ value }) => {
        this.token = value;
        void firstValueFrom(this.api.registerToken(value)).catch((error) => {
          console.warn('Unable to register push token:', error);
        });
      });
      await PushNotifications.addListener('registrationError', (error) => {
        console.warn('Push registration error:', error);
      });
      await PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
        const data = event.notification.data;
        const alertId = data?.['alertId'];
        if (typeof alertId === 'string') {
          void this.router.navigate(['/tabs/alerts', alertId]);
        } else if (typeof data?.['deviceId'] === 'string') {
          void this.router.navigate(['/tabs/buoys', data['deviceId']]);
        }
      });
      await PushNotifications.register();
    } catch (error) {
      this.initialized = false;
      console.warn('Unable to initialize native push notifications:', error);
      try {
        await PushNotifications.removeAllListeners();
      } catch (cleanupError) {
        console.warn('Unable to clean up native push listeners:', cleanupError);
      }
    }
  }

  async stop(): Promise<void> {
    const token = this.token;
    this.token = undefined;
    this.initialized = false;

    // Logout also runs on Ionic web: never invoke a native-only plugin there.
    if (!this.nativePushAvailable) return;

    if (token) {
      try {
        await firstValueFrom(this.api.unregisterToken(token));
      } catch (error) {
        // Token cleanup failure must never trap the user in a signed-in session.
        console.warn('Unable to unregister push token:', error);
      }
    }

    try {
      await PushNotifications.removeAllListeners();
    } catch (error) {
      console.warn('Unable to remove native push listeners:', error);
    }
  }
}
