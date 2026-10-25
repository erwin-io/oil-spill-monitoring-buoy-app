import {uiError} from '../core/ui-error';
import {Component,inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {IonContent,IonHeader,IonToolbar,IonTitle,IonButton,IonSearchbar,IonSelect,IonSelectOption,IonRefresher,IonRefresherContent} from '@ionic/angular/standalone';
import {ApiService} from '../core/api.service';
import {AuthService} from '../core/auth.service';
import {Device} from '../core/models';
@Component({standalone:true,imports:[CommonModule,FormsModule,RouterLink,IonContent,IonHeader,IonToolbar,IonTitle,IonButton,IonSearchbar,IonSelect,IonSelectOption,IonRefresher,IonRefresherContent],templateUrl:'./devices.page.html',styleUrls:['./devices.page.scss']})
export class DevicesPage{
 private api=inject(ApiService);private auth=inject(AuthService);
 items:Device[]=[];invitations:{deviceId:string;invitedAt:string}[]=[];transfers:{deviceId:string;requestId:string;expiresAt:string}[]=[];term='';filter='ALL';loading=true;error='';accepting='';
 onSearch(value: string | null | undefined):void{this.term=value??''}
 onlineLabel(d:Device):string{if(d.status==='DISABLED')return 'Disabled';if(!d.lastSeenAt)return 'Not yet online';const age=Date.now()-Date.parse(d.lastSeenAt);return Number.isFinite(age)&&age>=0&&age<60*60*1000?'Online':'Offline'}
 get shown(){return this.items.filter(d=>(d.name+' '+d.id).toLowerCase().includes(this.term.toLowerCase())&&(this.filter==='ALL'||d.latestClassification===this.filter))}
 get owned(){return this.shown.filter(d=>d.access==='OWNER')}
 get shared(){return this.shown.filter(d=>d.access==='VIEWER')}
 get legacy(){return this.shown.filter(d=>d.access!=='OWNER'&&d.access!=='VIEWER')}
 async ionViewWillEnter(){await this.load()}
 async load(event?:any){this.loading=true;this.error='';this.items=[];this.invitations=[];this.transfers=[];try{
  this.items=(await firstValueFrom(this.api.devices())).items;
  try{this.invitations=(await firstValueFrom(this.api.invitations())).items}catch{this.invitations=[]}
  try{this.transfers=(await firstValueFrom(this.api.incomingTransfers())).items}catch{this.transfers=[]}
 }catch(e){this.error=uiError(e)}finally{this.loading=false;event?.target?.complete()}}
 async acceptOwnership(transfer:{deviceId:string;requestId:string}){
  if(this.accepting)return;this.accepting=transfer.deviceId;this.error='';
  try{
   await firstValueFrom(this.api.acceptTransfer(transfer.deviceId,transfer.requestId));
   await this.auth.bootstrap();await this.load();
  }catch(e){this.error=uiError(e)}finally{this.accepting=''}
 }
  async accept(deviceId:string){if(this.accepting)return;this.accepting=deviceId;this.error='';try{
  await firstValueFrom(this.api.acceptInvitation(deviceId));await this.auth.bootstrap();await this.load()
 }catch(e){this.error=uiError(e)}finally{this.accepting=''}}
}
