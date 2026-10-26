import {Component,OnInit,OnDestroy,inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Router} from '@angular/router';
import {Platform} from '@ionic/angular';
import type {Subscription} from 'rxjs';
import {addIcons} from 'ionicons';
import {arrowBack} from 'ionicons/icons';
import {IonButton,IonButtons,IonIcon,ModalController,IonContent,IonFooter,IonHeader,IonInput,IonNote,IonSpinner,IonTitle,IonToolbar} from '@ionic/angular/standalone';
import {AuthService} from '../core/auth.service';

@Component({standalone:true,imports:[FormsModule,IonButton,IonButtons,IonIcon,IonContent,IonFooter,IonHeader,IonInput,IonNote,IonSpinner,IonTitle,IonToolbar],
template:`<ion-header class="no-shadow"><ion-toolbar color="primary">
<ion-buttons slot="start"><ion-button type="button" color="light" fill="clear" aria-label="Back to Profile" [disabled]="busy" (click)="close()"><ion-icon slot="icon-only" name="arrow-back" aria-hidden="true"></ion-icon></ion-button></ion-buttons><ion-title>Edit display name</ion-title>
</ion-toolbar></ion-header>
<ion-content class="display-name-content"><div class="ion-padding page">
<h2>Edit display name</h2><p class="hint">This name is displayed on your BlueGuard account.</p>
<ion-input label="Display name" labelPlacement="stacked" fill="outline" [(ngModel)]="name" [maxlength]="80" [disabled]="busy"></ion-input>
@if(error){<ion-note role="alert" color="danger">{{error}}</ion-note>}
</div></ion-content>
<ion-footer class="ion-no-border display-name-save-footer"><ion-toolbar>
<ion-button class="regular" expand="block" [disabled]="busy||name.trim().length<2||name.trim().length>80" (click)="save()">@if(busy){<ion-spinner name="dots" aria-label="Saving display name"></ion-spinner>}@else{Save display name}</ion-button>
</ion-toolbar></ion-footer>`,
styleUrls:['./login.page.scss','./edit-display-name.page.scss']})
export class EditDisplayNamePage implements OnInit,OnDestroy{
 private auth=inject(AuthService);private router=inject(Router);private modals=inject(ModalController);
 private platform=inject(Platform);
 private backSubscription?:Subscription;
 private closing=false;
 name='';busy=false;error='';
 constructor(){addIcons({arrowBack});}
 ngOnInit():void{
  this.name=this.auth.profile()?.displayName??'';this.error='';
  this.backSubscription=this.platform.backButton.subscribeWithPriority(1000,()=>{void this.close();});
 }
 ngOnDestroy():void{this.backSubscription?.unsubscribe();this.backSubscription=undefined;}
 async close():Promise<void>{
  if(this.busy||this.closing)return;
  this.closing=true;
  try{
   const top=await this.modals.getTop();
   if(top)await top.dismiss(undefined,'cancel');
   else await this.router.navigateByUrl('/tabs/profile',{replaceUrl:true});
  }finally{this.closing=false;}
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
