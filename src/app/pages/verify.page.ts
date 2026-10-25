import { Component, inject, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Platform } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowBack } from 'ionicons/icons';
import type { Subscription } from 'rxjs';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonNote,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonNote,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './verify.page.html',
  styleUrls: ['./login.page.scss','./verify.page.scss'],
})
export class VerifyPage implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly platform = inject(Platform);
  private backSubscription?: Subscription;
  private closing = false;
  message = '';
  busy = false;

  constructor() { addIcons({arrowBack}); }

  // Ionic caches the auth pages. Keep the hardware-Back subscription active
  // only for the currently visible verification-waiting page.
  ionViewWillEnter(): void {
    this.closing = false;
    if(this.backSubscription)return;
    this.backSubscription=this.platform.backButton.subscribeWithPriority(1000,()=>{
      void this.goLogin();
    });
  }

  ionViewWillLeave(): void {
    this.backSubscription?.unsubscribe();
    this.backSubscription=undefined;
  }

  async goLogin(): Promise<void> {
    if(this.closing)return;
    this.closing=true;
    this.ionViewWillLeave();
    await this.router.navigateByUrl('/login',{replaceUrl:true});
  }

  async resend(): Promise<void> {
    if (this.busy || this.closing) return;
    this.busy = true;
    this.message = '';
    try {
      // This page NEVER calls Firebase action apply/check. Verification is
      // performed only when Gmail opens /open/auth-action in BlueGuard.
      await this.auth.resendVerification();
      if(!this.closing)this.message = 'Verification email sent. Check your inbox and spam folder.';
    } catch (error) {
      if(!this.closing)this.message = (error as Error).message || 'Unable to resend verification email.';
    } finally {
      this.busy = false;
    }
  }

  ngOnDestroy(): void {
    this.closing=true;
    this.ionViewWillLeave();
  }
}
