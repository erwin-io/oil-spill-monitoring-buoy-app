import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonNote,
  IonRouterLink,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { AuthService } from '../core/auth.service';
import { getPostLoginTarget } from '../core/app-links';

@Component({
  standalone: true,
  imports: [
    RouterLink,
    IonRouterLink,
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonContent,
    IonHeader,
    IonNote,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './verify.page.html',
  styleUrls: ['./login.page.scss'],
})
export class VerifyPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  message = '';
  busy = false;

  async resend(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.message = '';
    try {
      await this.auth.resendVerification();
      this.message = 'Verification email sent. Check your inbox and spam folder.';
    } catch (error) {
      this.message = (error as Error).message;
    } finally {
      this.busy = false;
    }
  }

  async check(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.message = '';
    try {
      if (await this.auth.reloadVerified()) {
        await this.router.navigateByUrl(getPostLoginTarget(), { replaceUrl: true });
      } else {
        this.message = 'Email is not yet verified, or your account could not be initialized.';
      }
    } catch (error) {
      this.message = (error as Error).message;
    } finally {
      this.busy = false;
    }
  }
}
