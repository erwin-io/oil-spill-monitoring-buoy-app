import {Component, OnDestroy, OnInit, inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Router} from '@angular/router';
import {Platform} from '@ionic/angular';
import {addIcons} from 'ionicons';
import {arrowBack, checkmarkCircle} from 'ionicons/icons';
import type {Subscription} from 'rxjs';
import {
 IonButton, IonButtons, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle,
 IonCardTitle, IonContent, IonHeader, IonIcon, IonInput, IonInputPasswordToggle,
 IonNote, IonSpinner, IonTitle, IonToolbar, ModalController
} from '@ionic/angular/standalone';
import {AuthService} from '../core/auth.service';
import {AuthBusyOverlayComponent} from './auth-busy-overlay.component';

// Firebase action codes are staged by the verified Android App Link handler,
// held only in AuthService memory, and never put into the route or template.
@Component({
 standalone:true,
 imports:[
  FormsModule, IonButton, IonButtons, IonCard, IonCardContent, IonCardHeader,
  IonCardSubtitle, IonCardTitle, IonContent, IonHeader, IonIcon, IonInput,
  IonInputPasswordToggle, IonNote, IonSpinner, IonTitle, IonToolbar, AuthBusyOverlayComponent
 ],
 template:`
  <ion-header class="no-shadow">
    <ion-toolbar color="primary">
      <ion-buttons slot="start">
        <ion-button type="button" fill="clear" color="light"
          aria-label="Back to sign in" (click)="goLogin()">
          <ion-icon slot="icon-only" name="arrow-back" aria-hidden="true"></ion-icon>
        </ion-button>
      </ion-buttons>
      <ion-title>{{mode==='verifyEmail'?'Verify email':'Reset password'}}</ion-title>
    </ion-toolbar>
  </ion-header>

  <ion-content class="ion-padding page">
    <div class="wrap">
      <ion-card class="card no-shadow">
        <ion-card-header>
          <ion-card-title>{{mode==='verifyEmail'?'Verify your email':'Reset your password'}}</ion-card-title>
          <ion-card-subtitle>
            @if(mode==='verifyEmail'){
              Securely confirming your BlueGuard Buoy email with Firebase.
            } @else {
              Choose a new BlueGuard Buoy password. Your current password is never requested.
            }
          </ion-card-subtitle>
        </ion-card-header>
        <ion-card-content>
          @if(loading){
            <app-auth-busy-overlay [label]="progressMessage" kind="verify"></app-auth-busy-overlay>
          } @else if(success){
            <div class="auth-action-state" role="status" aria-live="polite">
              <ion-icon name="checkmark-circle" color="success" aria-hidden="true"></ion-icon>
              <p class="auth-action-heading">
                {{mode==='verifyEmail'?'Email verified successfully':'Password updated'}}
              </p>
              <p>{{mode==='verifyEmail'
                ?'Your email is verified. Use the back arrow or your device Back button to return to sign in.'
                :'Your password has been updated. Use Back to sign in with your new password.'}}</p>
            </div>
          } @else if(error && !ready){
            <ion-note class="form-error" color="danger" role="alert">{{error}}</ion-note>
            <p class="auth-action-hint">Return to sign in and request a fresh email link.</p>
          } @else if(ready && mode==='resetPassword'){
            <form class="fieldset" (ngSubmit)="submit()" novalidate>
              <ion-input name="nextPassword" [(ngModel)]="nextPassword"
                label="New password" labelPlacement="stacked" type="password"
                fill="outline" placeholder="Create a new password"
                autocomplete="new-password" helperText="At least 8 characters"
                [disabled]="busy" required minlength="8" maxlength="128">
                <ion-input-password-toggle slot="end"></ion-input-password-toggle>
              </ion-input>

              <ion-input name="confirmPassword" [(ngModel)]="confirmPassword"
                label="Confirm new password" labelPlacement="stacked" type="password"
                fill="outline" placeholder="Re-enter your new password"
                autocomplete="new-password" [disabled]="busy" required>
                <ion-input-password-toggle slot="end"></ion-input-password-toggle>
              </ion-input>
              @if(error){
                <ion-note class="form-error" color="danger" role="alert">{{error}}</ion-note>
              }
              <ion-button class="regular" type="submit" expand="block"
                [disabled]="busy || !nextPassword || !confirmPassword">
                @if(busy){
                  <ion-spinner name="dots" aria-label="Resetting password"></ion-spinner>
                } @else { Reset password }
              </ion-button>
            </form>
          }
        </ion-card-content>
      </ion-card>
    </div>
  </ion-content>
 `,
 styleUrls:['./login.page.scss','./native-email-action.page.scss'],
})
export class NativeEmailActionPage implements OnInit,OnDestroy{
 private readonly auth=inject(AuthService);
 private readonly router=inject(Router);
 private readonly platform=inject(Platform);
 private readonly modals=inject(ModalController);
 private verificationProgress?:HTMLIonModalElement;
 private backSubscription?:Subscription;
 private closed=false;
 mode:'resetPassword'|'verifyEmail'='resetPassword';
 nextPassword='';
 confirmPassword='';
 ready=false;
 loading=true;
 busy=false;
 success=false;
 error='';
 progressMessage='Checking the one-time email link…';

 constructor(){addIcons({arrowBack,checkmarkCircle});}
 private async showVerificationProgress():Promise<void>{
  const progress=await this.modals.create({
   component:AuthBusyOverlayComponent,
   componentProps:{label:'Verifying your email',kind:'verify'},
   cssClass:'blueguard-progress-modal',
   backdropDismiss:false,animated:false,
   canDismiss:async (_data,role)=>role==='complete'
  });
  this.verificationProgress=progress;
  if(!this.closed)await progress.present();
 }
 private async hideVerificationProgress():Promise<void>{
  const progress=this.verificationProgress;
  this.verificationProgress=undefined;
  try{await progress?.dismiss(undefined,'complete');}catch{}
 }
 private installBackHandler():void{
  if(this.backSubscription || this.closed)return;
  this.backSubscription=this.platform.backButton.subscribeWithPriority(1000,()=>{
   void this.goLogin();
  });
 }
 // Angular Ionic router outlets cache views; never intercept on Login.
 ionViewWillEnter():void{this.installBackHandler();}
 ionViewWillLeave():void{
  this.backSubscription?.unsubscribe();
  this.backSubscription=undefined;
 }

 async ngOnInit():Promise<void>{
  // Override Ionic's default Android history pop: this is an external
  // email-action entry and Back must always dismiss to the Login screen.
  this.installBackHandler();
  try{
   const action=await this.auth.inspectNativeEmailAction();
   if(this.closed)return;
   this.mode=action.mode;
   if(action.mode==='verifyEmail'){
    // No secondary 'Verify' button. Firebase verifies immediately after
    // Gmail opens the verified BlueGuard Android deep link.
    this.progressMessage='Verifying your email…';
    await this.showVerificationProgress();
    if(this.closed)return;
    await this.auth.finishNativeVerification();
    if(this.closed)return;
    this.success=true;
    this.ready=false;
   }else{
    this.ready=true;
   }
  }catch(e){
   if(this.closed)return;
   this.ready=false;
   this.error=(e as Error).message||'This link cannot be completed. Request a new one.';
  }finally{
   await this.hideVerificationProgress();
   if(!this.closed)this.loading=false;
  }
 }

 async submit():Promise<void>{
  if(this.closed || this.busy || !this.ready || this.success || this.mode!=='resetPassword')return;
  this.error='';
  if(this.nextPassword.length<8 || this.nextPassword.length>128){
   this.error='Choose a password between 8 and 128 characters.';
   return;
  }
  if(this.nextPassword!==this.confirmPassword){
   this.error='Passwords do not match.';
   return;
  }
  this.busy=true;
  this.loading=true;
  this.progressMessage='Updating your password…';
  try{
   await this.auth.finishNativePasswordReset(this.nextPassword);
   if(this.closed)return;
   this.success=true;
   this.ready=false;
  }catch{
   if(!this.closed)this.error='Unable to reset your password. Request a fresh link if this one has expired.';
  }finally{
   this.nextPassword='';
   this.confirmPassword='';
   this.busy=false;
   if(!this.closed)this.loading=false;
  }
 }

 async goLogin():Promise<void>{
  if(this.closed)return;
  this.closed=true;
  this.ionViewWillLeave();
  void this.hideVerificationProgress();
  this.auth.clearNativeEmailAction();
  this.nextPassword='';
  this.confirmPassword='';
  // replaceUrl prevents hardware Back returning to a used action screen.
  await this.router.navigateByUrl('/login',{replaceUrl:true});
 }

 ngOnDestroy():void{
  this.closed=true;
  this.ionViewWillLeave();
  void this.hideVerificationProgress();
  this.auth.clearNativeEmailAction();
  this.nextPassword='';
  this.confirmPassword='';
 }
}
