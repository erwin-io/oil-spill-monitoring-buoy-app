import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { initializeApp, getApp, getApps } from 'firebase/app';
import {
  getAuth,
  type Auth,
  type User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';
import { environment } from '../../environments/environment';
import { Profile } from './models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly firebaseApp = getApps().length
    ? getApp()
    : initializeApp(environment.firebase);
  private readonly auth: Auth = getAuth(this.firebaseApp);

  readonly currentUser = signal<User | null>(null);
  readonly profile = signal<Profile | null>(null);
  private sessionGeneration = 0;

  private readonly initialized = new Promise<void>((resolve) => {
    onAuthStateChanged(this.auth, (user) => {
      if (this.currentUser()?.uid !== user?.uid) {
        ++this.sessionGeneration;
        // Invalidate the old profile before pages calculate role-dependent UI.
        this.profile.set(null);
      }
      this.currentUser.set(user);
      resolve();
    });
  });

  async ready(): Promise<boolean> {
    await this.initialized;
    const user = this.auth.currentUser;
    if (!user || !user.emailVerified) return false;
    if (this.profile()?.uid !== user.uid) {
      try {
        await this.bootstrap();
      } catch {
        return false;
      }
    }
    return this.profile()?.uid === user.uid;
  }

  async token(): Promise<string> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Sign in required');
    return user.getIdToken();
  }

  async bootstrap(): Promise<Profile> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Sign in required');
    const generation = this.sessionGeneration;
    const token = await user.getIdToken();
    const profile = await firstValueFrom(
      this.http.post<Profile>(`${environment.api}/auth/bootstrap`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    if (generation !== this.sessionGeneration || this.auth.currentUser?.uid !== user.uid) {
      throw new Error('Session changed during profile bootstrap');
    }
    if (profile.uid !== user.uid) throw new Error('Profile identity mismatch');
    this.profile.set(profile);
    return profile;
  }

  async signIn(email: string, password: string): Promise<Profile> {
    await signInWithEmailAndPassword(this.auth, email, password);
    if (!this.auth.currentUser?.emailVerified) {
      throw new Error('Verify your email before continuing');
    }
    return this.bootstrap();
  }

  async register(email: string, password: string): Promise<User> {
    const result = await createUserWithEmailAndPassword(this.auth, email, password);
    await sendEmailVerification(result.user);
    return result.user;
  }

  async resendVerification(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Sign in required');
    await sendEmailVerification(user);
  }

  async reloadVerified(): Promise<boolean> {
    await this.auth.currentUser?.reload();
    await this.auth.currentUser?.getIdToken(true);
    return this.ready();
  }

  async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(this.auth, email);
  }

  async logout(): Promise<void> {
    ++this.sessionGeneration;
    this.profile.set(null);
    await signOut(this.auth);
  }
}
