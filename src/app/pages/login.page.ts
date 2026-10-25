import { Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonInput,
  IonInputPasswordToggle,
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
    ReactiveFormsModule,
    RouterLink,
    IonRouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonCard,
    IonCardContent,
    IonInput,
    IonInputPasswordToggle,
    IonButton,
    IonNote,
    IonSpinner,
  ],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  busy = false;
  error = '';

  async googleLogin(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      await this.auth.signInWithGoogle();
      this.form.controls.password.reset();
      await this.router.navigateByUrl(getPostLoginTarget(), { replaceUrl: true });
    } catch (error) {
      const message = (error as Error).message ?? '';
      if (/auth\/(popup-closed-by-user|cancelled-popup-request)|cancelled|canceled/i.test(message)) {
        // User dismissed the account chooser; no account or security changes.
      } else if (/auth\/(account-exists-with-different-credential)/.test(message)) {
        this.error = 'This email already has another sign-in method. Sign in with your email and password first.';
      } else if (/auth\/(unauthorized-domain|operation-not-allowed)/.test(message)) {
        this.error = 'Google Sign-In is not configured for this app address. Contact the administrator.';
      } else {
        this.error = message || 'Unable to sign in with Google. Please retry.';
      }
    } finally {
      this.busy = false;
    }
  }

  async login(): Promise<void> {
    if (this.busy) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.busy = true;
    this.error = '';
    const { email, password } = this.form.getRawValue();
    try {
      await this.auth.signIn(email.trim().toLowerCase(), password);
      this.form.controls.password.reset();
      await this.router.navigateByUrl(getPostLoginTarget(), { replaceUrl: true });
    } catch (error) {
      const message = (error as Error).message ?? '';
      this.form.controls.password.reset();
      if (message.includes('Verify your email')) {
        await this.router.navigateByUrl('/verify-email');
      } else if (/auth\/(invalid-credential|wrong-password|user-not-found)/.test(message)) {
        this.error = 'Email or password is incorrect. Try again or reset your password.';
      } else {
        this.error = message || 'Unable to sign in. Please try again.';
      }
    } finally {
      this.busy = false;
    }
  }
}
