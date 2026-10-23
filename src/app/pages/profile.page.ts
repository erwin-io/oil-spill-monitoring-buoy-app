import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonAvatar,
  IonBadge,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  checkmarkCircleOutline,
  hardwareChipOutline,
  informationCircleOutline,
  logOutOutline,
  mailOutline,
} from 'ionicons/icons';
import { AuthService } from '../core/auth.service';
import { RealtimeService } from '../core/realtime.service';
import { PushService } from '../core/push.service';

@Component({
  standalone: true,
  imports: [
    CommonModule, IonAvatar, IonBadge, IonButton, IonContent, IonHeader,
    IonIcon, IonItem, IonLabel, IonList, IonListHeader, IonNote, IonTitle, IonToolbar,
  ],
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

  constructor() {
    addIcons({
      alertCircleOutline, checkmarkCircleOutline, hardwareChipOutline,
      informationCircleOutline, logOutOutline, mailOutline,
    });
  }

  initials(name?: string): string {
    return (name ?? 'OS').trim().split(/\s+/).slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '').join('') || 'OS';
  }

  async logout(): Promise<void> {
    if (this.signingOut) return;
    this.signingOut = true;
    this.error = '';
    try {
      this.realtime.disconnect();
      try {
        await this.push.stop();
      } catch (error) {
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
