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
  styleUrls: ['./login.page.scss'],
})
export class ForgotPage {
  private readonly auth = inject(AuthService);
  email = '';
  message = '';
  busy = false;

  async reset(): Promise<void> {
    if (this.busy || !this.email.trim()) return;
    this.busy = true;
    this.message = '';
    try {
      await this.auth.resetPassword(this.email.trim().toLowerCase());
      this.message = 'If the address is eligible, password reset instructions have been sent.';
    } catch {
      this.message = 'Unable to submit the password reset request. Please try again.';
    } finally {
      this.busy = false;
    }
  }
}
