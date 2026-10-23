import { Component, inject } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
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
  IonInputPasswordToggle,
  IonNote,
  IonRouterLink,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { AuthService } from '../core/auth.service';

export function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value as string | undefined;
  const confirmation = control.get('confirmPassword')?.value as string | undefined;
  return password && confirmation && password !== confirmation
    ? { passwordMismatch: true }
    : null;
}

@Component({
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IonRouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonInput,
    IonInputPasswordToggle,
    IonButton,
    IonNote,
    IonSpinner,
  ],
  templateUrl: './register.page.html',
  styleUrls: ['./login.page.scss'],
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = inject(NonNullableFormBuilder).group(
    {
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  busy = false;
  message = '';

  get mismatch(): boolean {
    return this.form.hasError('passwordMismatch') &&
      this.form.controls.confirmPassword.touched;
  }

  async submit(): Promise<void> {
    if (this.busy) return;
    this.message = '';
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.busy = true;
    const { email, password } = this.form.getRawValue();
    try {
      await this.auth.register(email.trim().toLowerCase(), password);
      this.form.reset();
      await this.router.navigateByUrl('/verify-email', { replaceUrl: true });
    } catch (error) {
      const text = (error as Error).message ?? '';
      this.message = /auth\/email-already-in-use/.test(text)
        ? 'An account with this email already exists. Sign in or reset your password.'
        : text || 'Account registration failed. Please try again.';
    } finally {
      this.busy = false;
    }
  }
}
