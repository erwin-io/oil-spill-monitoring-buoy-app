import { Component, inject } from '@angular/core';
import { Platform } from '@ionic/angular';
import type {Subscription} from 'rxjs';
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
import { AuthBusyOverlayComponent } from './auth-busy-overlay.component';

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
    AuthBusyOverlayComponent,
  ],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly platform=inject(Platform);
  private backSubscription?:Subscription;
  private busyBackSubscription?:Subscription;
  // The root Sign In screen already consumes Android Back while idle.
  // Authentication gets a SECOND higher-priority subscription synchronously
  // on tap, before Firebase/Google starts. This prevents Ionic/router Back
  // from navigating away during the attempt even before the overlay renders.
  ionViewWillEnter():void{
    this.backSubscription?.unsubscribe();
    this.backSubscription=this.platform.backButton.subscribeWithPriority(1000,()=>{});
  }
  ionViewWillLeave():void{
    this.backSubscription?.unsubscribe();
    this.backSubscription=undefined;
    this.releaseBusyBackLock();
  }
  private startAuthAttempt(label:'Signing in'|'Connecting to Google'):void{
    // No awaits or native bridge round-trips before acquiring the lock.
    this.busy=true;
    this.busyLabel=label;
    this.error='';
    this.busyBackSubscription?.unsubscribe();
    this.busyBackSubscription=this.platform.backButton.subscribeWithPriority(10000,()=>{});
  }
  private releaseBusyBackLock():void{
    this.busyBackSubscription?.unsubscribe();
    this.busyBackSubscription=undefined;
  }

  readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  busy = false;
  busyLabel='Signing in';
  error = '';

  async googleLogin(): Promise<void> {
    if (this.busy) return;
    this.startAuthAttempt('Connecting to Google');
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
      this.releaseBusyBackLock();
    }
  }

  async login(): Promise<void> {
    if (this.busy) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.startAuthAttempt('Signing in');
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
      this.releaseBusyBackLock();
    }
  }
}
