import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import {
  getAuth,
  type Auth,
  type User,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  signOut,
} from 'firebase/auth';
import { environment } from '../../environments/environment';
import { Profile } from './models';
import {firebaseEmailActionSettings} from './firebase-email-actions';

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

  /**
   * Browser: Firebase popup. Android: system Google account chooser, then
   * exchange the native Google ID token for a Firebase JS session.
   *
   * Keeping Firebase JS as the single session authority is essential:
   * /auth/bootstrap and the HTTP interceptor use its Firebase ID token.
   * Only basic Google identity is requested; no Drive/Gmail scopes.
   */
  async signInWithGoogle(): Promise<Profile> {
    if (Capacitor.isNativePlatform()) {
      if (!Capacitor.isPluginAvailable('FirebaseAuthentication')) {
        throw new Error('Native Google Sign-In is unavailable. Rebuild the Android app and try again.');
      }
      // Avoid Credential Manager's 'No credentials available' failure on affected Android devices.
      // The legacy Google Sign-In SDK still returns an ID token for the Firebase JS session.
      const result = await FirebaseAuthentication.signInWithGoogle({ useCredentialManager: false });
      const googleIdToken = result.credential?.idToken;
      if (!googleIdToken) {
        throw new Error('Google Sign-In did not return an identity token. Check the Android SHA-1 and google-services.json configuration.');
      }
      await signInWithCredential(this.auth, GoogleAuthProvider.credential(googleIdToken));
    } else {
      await signInWithPopup(this.auth, new GoogleAuthProvider());
    }

    if (!this.auth.currentUser?.emailVerified) {
      throw new Error('Your Google account email must be verified before continuing');
    }
    return this.bootstrap();
  }

  // Prefer the configured API provider only when that API instance confirms
  // readiness. Old/non-deployed APIs return 404 and keep Firebase SDK emails.
  // A send failure AFTER backend activation is never silently retried via
  // Firebase, avoiding duplicate/mismatched secure action links.
  private async useBackendEmail(): Promise<boolean> {
    try {
      const config=await firstValueFrom(this.http.get<{delivery:'resend'|'firebase'}>(
        `${environment.api}/auth/email/config`));
      return config?.delivery==='resend';
    } catch {
      return false;
    }
  }

  async register(email: string, password: string): Promise<User> {
    const result = await createUserWithEmailAndPassword(this.auth, email, password);
    if(await this.useBackendEmail()){
      const token=await result.user.getIdToken();
      await firstValueFrom(this.http.post(`${environment.api}/auth/email/verification`,{},
        {headers:{Authorization:`Bearer ${token}`}}));
    }else{
      await sendEmailVerification(result.user,firebaseEmailActionSettings('verify'));
    }
    return result.user;
  }

  async resendVerification(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Sign in required');
    if(await this.useBackendEmail()){
      const token=await user.getIdToken();
      await firstValueFrom(this.http.post(`${environment.api}/auth/email/verification`,{},
        {headers:{Authorization:`Bearer ${token}`}}));
    }else{
      await sendEmailVerification(user,firebaseEmailActionSettings('verify'));
    }
  }

  async reloadVerified(): Promise<boolean> {
    await this.auth.currentUser?.reload();
    await this.auth.currentUser?.getIdToken(true);
    return this.ready();
  }

  async resetPassword(email: string): Promise<void> {
    if(await this.useBackendEmail()){
      await firstValueFrom(this.http.post(`${environment.api}/auth/email/password-reset`,
        {email:email.trim().toLowerCase()}));
    }else{
      await sendPasswordResetEmail(this.auth, email,firebaseEmailActionSettings('reset'));
    }
  }

  async updateDisplayName(displayName: string): Promise<Profile> {
    const user=this.auth.currentUser;
    if(!user||!user.emailVerified)throw new Error('Verified sign-in required');
    const generation=this.sessionGeneration;
    const token=await user.getIdToken();
    const profile=await firstValueFrom(this.http.patch<Profile>(
      `${environment.api}/auth/me`,{displayName},
      {headers:{Authorization:`Bearer ${token}`}},
    ));
    if(generation!==this.sessionGeneration||this.auth.currentUser?.uid!==user.uid||profile.uid!==user.uid)
      throw new Error('Account changed during profile update');
    this.profile.set(profile);
    return profile;
  }


  async uploadAvatar(file: Blob): Promise<Profile> {
    if (file.size < 12 || file.size > 2*1024*1024 || !['image/jpeg','image/png','image/webp'].includes(file.type))
      throw new Error('Choose a JPG, PNG, or WebP image up to 2 MB.');
    const user=this.auth.currentUser;
    if (!user?.emailVerified) throw new Error('Verified sign-in required');
    const generation=this.sessionGeneration;
    const token=await user.getIdToken();
    const response=await firstValueFrom(this.http.put<Pick<Profile,'uid'|'avatarUrl'>>(
      `${environment.api}/auth/avatar`,file,
      {headers:{Authorization:`Bearer ${token}`,'Content-Type':file.type}},
    ));
    if(generation!==this.sessionGeneration||this.auth.currentUser?.uid!==user.uid||response.uid!==user.uid)
      throw new Error('Account changed during avatar upload');
    const updated={...this.profile(),...response} as Profile;
    this.profile.set(updated);return updated;
  }

  async removeAvatar(): Promise<Profile> {
    const user=this.auth.currentUser;
    if (!user?.emailVerified) throw new Error('Verified sign-in required');
    const generation=this.sessionGeneration;
    const token=await user.getIdToken();
    const response=await firstValueFrom(this.http.delete<Pick<Profile,'uid'|'avatarUrl'>>(
      `${environment.api}/auth/avatar`,{headers:{Authorization:`Bearer ${token}`}},
    ));
    if(generation!==this.sessionGeneration||this.auth.currentUser?.uid!==user.uid||response.uid!==user.uid)
      throw new Error('Account changed during avatar removal');
    const updated={...this.profile(),...response} as Profile;
    this.profile.set(updated);return updated;
  }

  async changePassword(currentPassword: string, nextPassword: string): Promise<void> {
    const user=this.auth.currentUser;
    if(!user?.email||!user.emailVerified)throw new Error('Sign in with a verified email first');
    if(!user.providerData.some(p=>p.providerId==='password'))throw new Error('This account signs in with Google; password changes are not available.');
    if(nextPassword.length<8||nextPassword.length>128)throw new Error('New password must contain 8–128 characters');
    if(currentPassword===nextPassword)throw new Error('Choose a different new password');
    const generation=this.sessionGeneration;
    await reauthenticateWithCredential(user,EmailAuthProvider.credential(user.email,currentPassword));
    if(generation!==this.sessionGeneration||this.auth.currentUser?.uid!==user.uid)
      throw new Error('Account changed during password reauthentication');
    await updatePassword(user,nextPassword);
  }

  async logout(): Promise<void> {
    ++this.sessionGeneration;
    this.profile.set(null);
    await signOut(this.auth);
  }
}
