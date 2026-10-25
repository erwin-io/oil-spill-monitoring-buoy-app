import {uiError} from '../core/ui-error';
import {Component,inject} from '@angular/core';import {CommonModule} from '@angular/common';import {FormsModule} from '@angular/forms';import {RouterLink,ActivatedRoute} from '@angular/router';import {firstValueFrom} from 'rxjs';
import {IonContent,IonHeader,IonToolbar,IonTitle,IonButton,IonBackButton,IonButtons,IonInput,IonRefresher,IonRefresherContent} from '@ionic/angular/standalone';
import {ApiService} from '../core/api.service';import {Device,Measurement,Health} from '../core/models';
@Component({standalone:true,imports:[CommonModule,FormsModule,RouterLink,IonContent,IonHeader,IonToolbar,IonTitle,IonButton,IonBackButton,IonButtons,IonInput,IonRefresher,IonRefresherContent],templateUrl:'./device-detail.page.html',styleUrls:['./device-detail.page.scss']})
export class DeviceDetailPage{
 private route=inject(ActivatedRoute);private api=inject(ApiService);id=this.route.snapshot.paramMap.get('id')??'';
 device?:Device;latest?:Measurement;health?:Health;busy=true;error='';inviteEmail='';inviteMessage='';inviting=false;transferEmail='';transferConfirmId='';transferring=false;transferMessage='';
 async ionViewWillEnter(){await this.load()}
 async load(e?:any){this.busy=true;this.error='';this.device=undefined;this.latest=undefined;this.health=undefined;try{
  this.device=await firstValueFrom(this.api.device(this.id));
  this.latest=await firstValueFrom(this.api.latest(this.id)).catch(()=>undefined);
  this.health=(await firstValueFrom(this.api.health(this.id)).catch(()=>({items:[]} as {items:Health[]}))).items[0]
 }catch(x){this.error=uiError(x)}finally{this.busy=false;e?.target?.complete()}}
 async requestTransfer(){
  if(this.transferring||this.device?.access!=='OWNER'||this.transferConfirmId.trim()!==this.id)return;
  this.transferring=true;this.transferMessage='';this.error='';
  try{
   const result=await firstValueFrom(this.api.startTransfer(this.id,this.transferEmail.trim()));
   this.transferMessage='Ownership transfer pending recipient acceptance until '+result.expiresAt;
   this.transferEmail='';this.transferConfirmId='';
  }catch(e){this.error=uiError(e)}finally{this.transferring=false}
 }
 async cancelTransfer(){
  if(this.transferring||this.device?.access!=='OWNER')return;this.transferring=true;this.error='';
  try{await firstValueFrom(this.api.cancelTransfer(this.id));this.transferMessage='Pending ownership transfer cancelled.'}
  catch(e){this.error=uiError(e)}finally{this.transferring=false}
 }
  async invite(){if(this.inviting||this.device?.access!=='OWNER')return;this.inviting=true;this.inviteMessage='';this.error='';try{
  await firstValueFrom(this.api.inviteViewer(this.id,this.inviteEmail.trim()));
  this.inviteEmail='';this.inviteMessage='Invitation ready. The verified account must accept it in My Buoys.'
 }catch(e){this.error=uiError(e)}finally{this.inviting=false}}
}
