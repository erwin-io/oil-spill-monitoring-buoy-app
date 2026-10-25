import {Component,OnDestroy,OnInit,inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Router} from '@angular/router';
import {
 IonButton,IonCard,IonCardContent,IonCardHeader,IonCardSubtitle,IonCardTitle,
 IonContent,IonHeader,IonInput,IonInputPasswordToggle,IonNote,IonSpinner,
 IonTitle,IonToolbar
} from '@ionic/angular/standalone';
import {AuthService} from '../core/auth.service';

// Strictly native Firebase email action UI. The code never enters a route,
// native logs, a Web URL, HTML markup, analytics or localStorage.
@Component({
 standalone:true,
 imports:[
  FormsModule,IonButton,IonCard,IonCardContent,IonCardHeader,IonCardSubtitle,
  IonCardTitle,IonContent,IonHeader,IonInput,IonInputPasswordToggle,
  IonNote,IonSpinner,IonTitle,IonToolbar
 ],
 template:`
  <ion-header><ion-toolbar><ion-title>BlueGuard Account Security</ion-title></ion-toolbar></ion-header>
  <ion-content class="ion-padding">
   <ion-card>
    <ion-card-header>
     <ion-card-title>{{mode==='resetPassword'?'Reset your password':'Verify your email'}}</ion-card-title>
     <ion-card-subtitle>Secure Firebase Authentication · BlueGuard Buoy</ion-card-subtitle>
    </ion-card-header>
    <ion-card-content>
     @if(loading){<ion-spinner></ion-spinner><p>Checking the one-time email link…</p>}
     @if(error){<ion-note color="danger">{{error}}</ion-note>}
     @if(success){
      <p>{{mode==='resetPassword'?'Password updated. Sign in with your new password.':'Email verified. You can now sign in to BlueGuard Buoy.'}}</p>
      <ion-button expand="block" (click)="goLogin()">Continue to login</ion-button>
     } @else if(ready&&!loading) {
      @if(mode==='resetPassword'){
       <p>Choose a new password. Your current password is never requested.</p>
       <ion-input label="New password" labelPlacement="stacked" type="password"
        autocomplete="new-password" [(ngModel)]="nextPassword" [disabled]="busy">
        <ion-input-password-toggle slot="end"></ion-input-password-toggle>
       </ion-input>
       <ion-input label="Confirm new password" labelPlacement="stacked" type="password"
        autocomplete="new-password" [(ngModel)]="confirmPassword" [disabled]="busy">
        <ion-input-password-toggle slot="end"></ion-input-password-toggle>
       </ion-input>
       <ion-button expand="block" (click)="submit()" [disabled]="busy || !nextPassword || !confirmPassword">
        @if(busy){<ion-spinner></ion-spinner>} @else {Reset password}
       </ion-button>
      } @else {
       <p>Confirm the email address for your BlueGuard Buoy account.</p>
       <ion-button expand="block" (click)="submit()" [disabled]="busy">
        @if(busy){<ion-spinner></ion-spinner>} @else {Verify email}
       </ion-button>
      }
     }
     @if(!loading&&!busy&&!ready&&!success) {
      <ion-button expand="block" (click)="goLogin()">Back to login</ion-button>
     }
    </ion-card-content>
   </ion-card>
  </ion-content>
 `,
 styleUrls:['./login.page.scss'],
})
export class NativeEmailActionPage implements OnInit,OnDestroy{
 private readonly auth=inject(AuthService);
 private readonly router=inject(Router);
 mode:'resetPassword'|'verifyEmail'='resetPassword';
 nextPassword='';
 confirmPassword='';
 ready=false;loading=true;busy=false;success=false;error='';
 private finished=false;

 async ngOnInit():Promise<void>{
  try{
   const action=await this.auth.inspectNativeEmailAction();
   this.mode=action.mode;
   this.ready=true;
  }catch(e){this.error=(e as Error).message||'Request a new email link.'}
  finally{this.loading=false}
 }

 async submit():Promise<void>{
  if(this.busy||!this.ready||this.success)return;
  this.error='';
  if(this.mode==='resetPassword'){
   if(this.nextPassword.length<8||this.nextPassword.length>128){
    this.error='Choose a password between 8 and 128 characters.';return;
   }
   if(this.nextPassword!==this.confirmPassword){
    this.error='Passwords do not match.';return;
   }
  }
  this.busy=true;
  try{
   if(this.mode==='resetPassword'){
    await this.auth.finishNativePasswordReset(this.nextPassword);
   }else{
    // Verified Firebase account status alone grants no Owner/Viewer access.
    await this.auth.finishNativeVerification();
   }
   this.finished=true;this.success=true;this.ready=false;
  }catch{
   this.error='Unable to complete this email action. Check your connection or request a fresh link.';
  }finally{
   this.nextPassword='';this.confirmPassword='';this.busy=false;
  }
 }
 async goLogin():Promise<void>{
  this.auth.clearNativeEmailAction();
  await this.router.navigateByUrl('/login',{replaceUrl:true});
 }
 ngOnDestroy():void{
  this.nextPassword='';this.confirmPassword='';
  if(!this.finished)this.auth.clearNativeEmailAction();
 }
}
