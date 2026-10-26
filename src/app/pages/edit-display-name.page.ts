import {Component,inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Router} from '@angular/router';
import {IonButton,IonButtons,ModalController,IonContent,IonHeader,IonInput,IonNote,IonSpinner,IonTitle,IonToolbar} from '@ionic/angular/standalone';
import {AuthService} from '../core/auth.service';
@Component({standalone:true,imports:[FormsModule,IonBackButton,IonButton,IonButtons,IonContent,IonHeader,IonInput,IonNote,IonSpinner,IonTitle,IonToolbar],
template:`<ion-header class="no-shadow"><ion-toolbar color="primary">
<ion-buttons slot="start"><ion-button color="light" fill="clear" aria-label="Close Edit Display Name" (click)="close()">Close</ion-button></ion-buttons><ion-title>Edit display name</ion-title>
</ion-toolbar></ion-header>
<ion-content class="ion-padding page"><div class="wrap">
<h2>Edit display name</h2><p class="hint">This name is displayed on your BlueGuard account.</p>
<ion-input label="Display name" labelPlacement="stacked" fill="outline" [(ngModel)]="name" [maxlength]="80"></ion-input>
@if(error){<ion-note role="alert" color="danger">{{error}}</ion-note>}
<ion-button class="regular" expand="block" [disabled]="busy||name.trim().length<2||name.trim().length>80" (click)="save()">@if(busy){<ion-spinner name="dots"></ion-spinner>}@else{Save display name}</ion-button>
</div></ion-content>`,styleUrls:['./login.page.scss']})
export class EditDisplayNamePage{
 private auth=inject(AuthService);private router=inject(Router);private modals=inject(ModalController);
 name='';busy=false;error='';
 ngOnInit():void{this.name=this.auth.profile()?.displayName??'';this.error='';}
 async close():Promise<void>{
  if(this.busy)return;
  const top=await this.modals.getTop();
  if(top)await top.dismiss(undefined,'cancel');
  else await this.router.navigateByUrl('/tabs/profile',{replaceUrl:true});
 }
 async save():Promise<void>{
  if(this.busy)return;const name=this.name.trim();
  if(name.length<2||name.length>80){this.error='Display name must be between 2 and 80 characters.';return;}
  this.busy=true;this.error='';
  try{
   await this.auth.updateDisplayName(name);
   const top=await this.modals.getTop();
   if(top)await top.dismiss(undefined,'saved');
   else await this.router.navigateByUrl('/tabs/profile',{replaceUrl:true});
  }
  catch(e){this.error=(e as Error).message||'Unable to update name';}
  finally{this.busy=false;}
 }
}
