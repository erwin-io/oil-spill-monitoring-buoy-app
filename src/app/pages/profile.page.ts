import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { AuthService } from '../core/auth.service';
import { RealtimeService } from '../core/realtime.service';
import { PushService } from '../core/push.service';

@Component({
  standalone: true,
  imports: [CommonModule, IonContent, IonHeader, IonToolbar, IonTitle, IonButton],
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
})
export class ProfilePage {
  readonly auth = inject(AuthService);
  private readonly realtime = inject(RealtimeService);
  private readonly push = inject(PushService);
  private readonly router = inject(Router);

  error = '';
  signingOut = false;

  async logout(): Promise<void> {
    if (this.signingOut) return;
    this.signingOut = true;
    this.error = '';

    try {
      this.realtime.disconnect();
      try {
        await this.push.stop();
      } catch (error) {
        // Push cleanup is best-effort; Firebase logout must still complete.
        console.warn('Push cleanup failed during logout:', error);
      }
      await this.auth.logout();
      await this.router.navigateByUrl('/login', { replaceUrl: true });
    } catch (error) {
      this.error = (error as Error).message || 'Unable to sign out. Please try again.';
    } finally {
      this.signingOut = false;
    }
  }
}
