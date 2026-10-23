import {inject,Injectable,signal} from '@angular/core';
import {initializeApp,getApps,getApp} from 'firebase/app';
import {getAuth,Auth,User,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,sendEmailVerification,sendPasswordResetEmail,signOut,GoogleAuthProvider,signInWithPopup,signInWithCredential} from 'firebase/auth';
import {Capacitor} from '@capacitor/core';
import {FirebaseAuthentication} from '@capacitor-firebase/authentication';
import {HttpClient} from '@angular/common/http';import {firstValueFrom} from 'rxjs';
import {environment} from '../../environments/environment';import {Profile} from './models';
@Injectable({providedIn:'root'}) export class AuthService {
 private http=inject(HttpClient); private app=getApps().length?getApp():initializeApp(environment.firebase);private auth:Auth=getAuth(this.app);
 readonly currentUser=signal<User|null>(null);readonly profile=signal<Profile|null>(null);
 private initialized=new Promise<void>(resolve=>{onAuthStateChanged(this.auth,u=>{this.currentUser.set(u);resolve()})});
 async ready(){await this.initialized;const u=this.auth.currentUser;if(!u||!u.emailVerified)return false;
  if(!this.profile()){try{await this.bootstrap()}catch{return false}}return true}
 async token(){const u=this.auth.currentUser;if(!u)throw new Error('Sign in required');return u.getIdToken()}
 async bootstrap(){const token=await this.token();const p=await firstValueFrom(this.http.post<Profile>(`${environment.api}/auth/bootstrap`,{}, {headers:{Authorization:`Bearer ${token}`}}));this.profile.set(p);return p}
 async signIn(email:string,password:string){await signInWithEmailAndPassword(this.auth,email,password);if(!this.auth.currentUser?.emailVerified)throw new Error('Verify your email before continuing');return this.bootstrap()}
 async register(email:string,password:string){const r=await createUserWithEmailAndPassword(this.auth,email,password);await sendEmailVerification(r.user);return r.user}
 async resendVerification(){const u=this.auth.currentUser;if(!u)throw new Error('Sign in required');await sendEmailVerification(u)}
 async reloadVerified(){await this.auth.currentUser?.reload();await this.auth.currentUser?.getIdToken(true);return this.ready()}
 async resetPassword(email:string){await sendPasswordResetEmail(this.auth,email)}
 async signInGoogle(){if(Capacitor.isNativePlatform()){
  const result=await FirebaseAuthentication.signInWithGoogle();if(!result.credential?.idToken)throw new Error('Native Google credential unavailable');await signInWithCredential(this.auth,GoogleAuthProvider.credential(result.credential.idToken));
 }else await signInWithPopup(this.auth,new GoogleAuthProvider());return this.bootstrap()}
 async logout(){this.profile.set(null);if(Capacitor.isNativePlatform())await FirebaseAuthentication.signOut().catch(()=>{});await signOut(this.auth)}
}
