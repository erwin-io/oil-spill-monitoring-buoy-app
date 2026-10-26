import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonInput,
  IonNote,
  IonRouterLink,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    IonRouterLink,
    IonBackButton,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonContent,
    IonHeader,
    IonInput,
    IonNote,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './forgot.page.html',
  styleUrls: ['./login.page.scss','./verify.page.scss'],
})
export class ForgotPage {
  private readonly auth = inject(AuthService);
  email = '';
  message = '';
  busy = false;
  sent = false;
  sendingEmail = '';

  async reset(): Promise<void> {
    if (this.busy || !this.email.trim()) return;
    const resending=this.sent;
    this.busy = true;
    this.message = '';
    try {
      await this.auth.resetPassword(this.email.trim().toLowerCase());
      this.sendingEmail=this.email.trim().toLowerCase();
      this.sent=true;
      this.message=resending?'If eligible, another reset email has been sent. Check your inbox.':'';
    } catch (error) {
      const message=(error as Error)?.message??'';
      if(message.includes('BlueGuard email delivery is not ready')){
        this.message='Password reset is currently unavailable: native email delivery is not configured on the server. Contact the BlueGuard administrator.';
      }else if(/429|RATE_LIMITED/i.test(message)){
        this.message='Too many requests. Please try again later.';
      }else if(/network|failed to fetch|status 0|offline/i.test(message)){
        this.message='Unable to connect to BlueGuard. Check your internet connection and try again.';
      }else{
        this.message='Could not submit the reset request. Please try again or contact the administrator.';
      }
    } finally {
      this.busy = false;
    }
  }
}
