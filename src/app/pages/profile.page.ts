import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonAvatar,
  IonBadge,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
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
    CommonModule, FormsModule, IonAvatar, IonBadge, IonButton, IonContent, IonHeader,
    IonIcon, IonInput, IonItem, IonLabel, IonList, IonListHeader, IonNote, IonTitle, IonToolbar,
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
  currentPassword='';newPassword='';confirmPassword='';changingPassword=false;passwordFeedback='';

  constructor() {
    addIcons({
      alertCircleOutline, checkmarkCircleOutline,
      informationCircleOutline, logOutOutline, mailOutline,
    });
  }

  initials(name?: string): string {
    return (name ?? 'OS').trim().split(/\s+/).slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '').join('') || 'OS';
  }

  async changePassword():Promise<void>{
    if(this.changingPassword)return;
    this.passwordFeedback='';
    if(this.newPassword!==this.confirmPassword){this.passwordFeedback='New passwords do not match';return}
    this.changingPassword=true;
    try{
      await this.auth.changePassword(this.currentPassword,this.newPassword);
      this.currentPassword='';this.newPassword='';this.confirmPassword='';
      this.passwordFeedback='Password updated successfully.';
    }catch(e){this.passwordFeedback=(e as Error)?.message||'Unable to change password'}
    finally{this.changingPassword=false}
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
