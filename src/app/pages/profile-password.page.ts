import {Component,inject} from '@angular/core';
import {IonBackButton,IonButton,IonButtons,IonContent,IonHeader,IonNote,IonSpinner,IonTitle,IonToolbar} from '@ionic/angular/standalone';
import {AuthService} from '../core/auth.service';
@Component({standalone:true,imports:[IonBackButton,IonButton,IonButtons,IonContent,IonHeader,IonNote,IonSpinner,IonTitle,IonToolbar],
template:`<ion-header class="no-shadow"><ion-toolbar color="primary"><ion-buttons slot="start"><ion-back-button defaultHref="/tabs/profile"></ion-back-button></ion-buttons><ion-title>Change password</ion-title></ion-toolbar></ion-header>
<ion-content class="ion-padding verify-wait-page"><main class="verify-wait-layout"><section class="verify-wait-group">
<div class="verify-wait-illustration" aria-hidden="true"><svg viewBox="0 0 180 160" width="180" height="160"><circle cx="90" cy="80" r="73" fill="#eaf3ff"/><rect x="42" y="49" width="96" height="71" rx="8" fill="#fff" stroke="#0058db" stroke-width="4"/><path d="M44 57 L90 91 L136 57" fill="none" stroke="#0058db" stroke-width="4"/><circle cx="134" cy="44" r="21" fill="#0cbb89"/><path d="M125 44 L132 51 L144 37" fill="none" stroke="#fff" stroke-width="4"/></svg></div>
<h1>{{sent?'Check your inbox':'Change password'}}</h1>
<p class="verify-wait-description">{{sent?'If eligible, a reset email has been sent. Open Gmail and choose your new password securely inside BlueGuard Buoy.':'For your security, we will send a one-time password reset link to your verified account email. No current password required.'}}</p>
<ion-button expand="block" class="regular verify-resend-button" fill="outline" [disabled]="busy" (click)="send()">@if(busy){<ion-spinner name="dots"></ion-spinner>}@else{{{sent?'Resend reset email':'Send password reset link'}}}</ion-button>
@if(message){<ion-note class="verify-wait-message" role="status">{{message}}</ion-note>}
</section></main></ion-content>`,styleUrls:['./login.page.scss','./verify.page.scss']})
export class ProfilePasswordPage{
 private auth=inject(AuthService);
 busy=false;sent=false;message='';
 async send():Promise<void>{
  if(this.busy)return;
  const email=this.auth.profile()?.email;
  if(!email){this.message='Account email unavailable. Sign in again.';return;}
  this.busy=true;this.message='';
  try{await this.auth.resetPassword(email);this.sent=true;}
  catch{this.message='Unable to send the reset email. Please try again.';}
  finally{this.busy=false;}
 }
}
