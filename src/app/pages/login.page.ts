import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonInput, IonButton } from '@ionic/angular/standalone';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, IonContent, IonInput, IonButton],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage {
  email = '';
  password = '';
  busy = false;
  error = '';

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  async login(): Promise<void> {
    this.busy = true;
    this.error = '';
    try {
      await this.auth.signIn(this.email, this.password);
      await this.router.navigateByUrl('/tabs/overview', { replaceUrl: true });
    } catch (error) {
      this.error = (error as Error).message;
      if (this.error.includes('Verify')) {
        await this.router.navigateByUrl('/verify-email');
      }
    } finally {
      this.busy = false;
    }
  }
}
