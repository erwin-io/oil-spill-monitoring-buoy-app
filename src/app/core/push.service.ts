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
  private generation = 0;
  // Serializes token refresh and logout, including in-flight API registration.
  private registrationTask: Promise<void> = Promise.resolve();

  private get nativePushAvailable(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('PushNotifications');
  }

  async start(): Promise<void> {
    if (!this.nativePushAvailable || this.initialized) return;

    this.initialized = true;
    const generation = ++this.generation;
    try {
      const permission = await PushNotifications.requestPermissions();
      if (generation !== this.generation) return;
      if (permission.receive !== 'granted') {
        this.initialized = false;
        return;
      }

      await PushNotifications.addListener('registration', ({ value }) => {
        this.registrationTask = this.registrationTask.catch(() => undefined).then(async () => {
          if (generation !== this.generation || !value || value === this.token) return;
          const previous = this.token;
          try {
            await firstValueFrom(this.api.registerToken(value));
          } catch (error) {
            console.warn('Unable to register push token:', error);
            return;
          }
          if (generation !== this.generation) {
            // Logout occurred while the register request was in flight. Revoke
            // the newly registered token to avoid notifications after sign-out.
            try {
              await firstValueFrom(this.api.unregisterToken(value));
            } catch (error) {
              console.warn('Unable to revoke late push token:', error);
            }
            return;
          }
          this.token = value;
          if (previous && previous !== value) {
            try {
              await firstValueFrom(this.api.unregisterToken(previous));
            } catch (error) {
              console.warn('Unable to retire previous push token:', error);
            }
          }
        });
      });
      if (generation !== this.generation) {
        await PushNotifications.removeAllListeners();
        return;
      }

      await PushNotifications.addListener('registrationError', (error) => {
        if (generation === this.generation) console.warn('Push registration error:', error);
      });
      if (generation !== this.generation) {
        await PushNotifications.removeAllListeners();
        return;
      }

      await PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
        if (generation !== this.generation) return;
        const data = event.notification.data;
        const alertId = data?.['alertId'];
        if (typeof alertId === 'string' && alertId.length > 0) {
          void this.router.navigate(['/tabs/alerts', alertId]);
        } else if (typeof data?.['deviceId'] === 'string' && data['deviceId'].length > 0) {
          void this.router.navigate(['/tabs/buoys', data['deviceId']]);
        }
      });
      if (generation !== this.generation) {
        await PushNotifications.removeAllListeners();
        return;
      }
      await PushNotifications.register();
    } catch (error) {
      if (generation !== this.generation) return;
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
    ++this.generation;
    const token = this.token;
    this.token = undefined;
    this.initialized = false;
    if (!this.nativePushAvailable) return;

    // Wait for registration and possible late-token cleanup BEFORE the user
    // identity is signed out. Prevent a background FCM callback resurrecting
    // an active backend token after logout.
    await this.registrationTask.catch(() => undefined);
    if (token) {
      try {
        await firstValueFrom(this.api.unregisterToken(token));
      } catch (error) {
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
