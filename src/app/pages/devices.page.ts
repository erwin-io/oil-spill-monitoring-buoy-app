import {uiError} from '../core/ui-error';
import {AddDeviceModalService} from '../core/add-device-modal.service';
import {EmptyStateComponent} from './empty-state.component';
import {addIcons} from 'ionicons';
import {addOutline} from 'ionicons/icons';
import {Component,inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {IonContent,IonHeader,IonToolbar,IonTitle,IonButton,IonSearchbar,IonSelect,IonSelectOption,IonRefresher,IonRefresherContent,IonFab,IonFabButton,IonIcon} from '@ionic/angular/standalone';
import {ApiService} from '../core/api.service';
import {AuthService} from '../core/auth.service';
import {ScreenCacheService} from '../core/screen-cache.service';
import {Device} from '../core/models';

type Invitation={deviceId:string;invitedAt:string};
type IncomingTransfer={deviceId:string;requestId:string;expiresAt:string};

@Component({standalone:true,
 imports:[CommonModule,FormsModule,RouterLink,IonContent,IonHeader,IonToolbar,IonTitle,IonButton,IonSearchbar,IonSelect,IonSelectOption,IonRefresher,IonRefresherContent,IonFab,IonFabButton,IonIcon,EmptyStateComponent],
 templateUrl:'./devices.page.html',styleUrls:['./devices.page.scss']})
export class DevicesPage{
 readonly addDeviceModal=inject(AddDeviceModalService);
 private api=inject(ApiService);private auth=inject(AuthService);
 readonly cache=inject(ScreenCacheService);
 constructor(){addIcons({addOutline});}
 private renderedUid:string|null=null;
 private loadingPromise?:Promise<void>;
 items:Device[]=[];invitations:Invitation[]=[];transfers:IncomingTransfer[]=[];
 term='';filter='ALL';loading=true;loadedOnce=false;error='';accepting='';
 get stale(){return this.cache.isStale('devices')||this.cache.isStale('invitations')||this.cache.isStale('transfers');}
 onSearch(value: string | null | undefined){this.term=value??''}
 onlineLabel(d:Device):string{
  if(d.status==='DISABLED')return 'Disabled';
  if(!d.lastSeenAt)return 'Not yet online';
  const age=Date.now()-Date.parse(d.lastSeenAt);
  return Number.isFinite(age)&&age>=0&&age<60*60*1000?'Online':'Offline';
 }
 get shown(){return this.items.filter(d=>(d.name+' '+d.id).toLowerCase().includes(this.term.toLowerCase())&&(this.filter==='ALL'||d.latestClassification===this.filter))}
 get owned(){return this.shown.filter(d=>d.access==='OWNER')}
 get shared(){return this.shown.filter(d=>d.access==='VIEWER')}
 get legacy(){return this.shown.filter(d=>d.access!=='OWNER'&&d.access!=='VIEWER')}
 async ionViewWillEnter(){await this.load();}
 ionViewWillLeave():void{}
 async load(event?:any,forceFresh=false){
  const uid=this.auth.profile()?.uid??null;
  if(this.renderedUid!==uid){
   this.renderedUid=uid;this.items=[];this.invitations=[];this.transfers=[];this.loadedOnce=false;
  }
  if(this.loadingPromise){await this.loadingPromise;event?.target?.complete();return;}
  const force=forceFresh||Boolean(event);
  const snapshot=['devices','invitations','transfers'].every(key=>this.cache.hasSnapshot(key as 'devices'|'invitations'|'transfers'));
  this.loading=!snapshot&&!this.loadedOnce;
  this.error='';
  const task=(async()=>{
   try{
    await Promise.all([
     this.cache.ensure<{items:Device[]}>('devices',()=>firstValueFrom(this.api.devices(force)),data=>{
      if(uid!==this.auth.profile()?.uid)return;
      this.items=data.items;this.loadedOnce=true;this.loading=false;
     },force),
     this.cache.ensure<{items:Invitation[]}>('invitations',()=>firstValueFrom(this.api.invitations(force)),data=>{
      if(uid===this.auth.profile()?.uid){this.invitations=data.items;this.loadedOnce=true;this.loading=false;}
     },force),
     this.cache.ensure<{items:IncomingTransfer[]}>('transfers',()=>firstValueFrom(this.api.incomingTransfers(force)),data=>{
      if(uid===this.auth.profile()?.uid){this.transfers=data.items;this.loadedOnce=true;this.loading=false;}
     },force)
    ]);
    this.cache.connectRealtime();
   }catch(e){if(uid===this.auth.profile()?.uid)this.error=uiError(e);}
   finally{this.loading=false;this.loadingPromise=undefined;event?.target?.complete();}
  })();
  this.loadingPromise=task;await task;
 }
 async acceptOwnership(transfer:IncomingTransfer){
  if(this.accepting)return;this.accepting=transfer.deviceId;this.error='';
  try{
   await firstValueFrom(this.api.acceptTransfer(transfer.deviceId,transfer.requestId));
   this.cache.markStale();await this.auth.bootstrap();await this.load(undefined,true);
  }catch(e){this.error=uiError(e);}finally{this.accepting='';}
 }
 async accept(deviceId:string){
  if(this.accepting)return;this.accepting=deviceId;this.error='';
  try{
   await firstValueFrom(this.api.acceptInvitation(deviceId));
   this.cache.markStale();await this.auth.bootstrap();await this.load(undefined,true);
  }catch(e){this.error=uiError(e);}finally{this.accepting='';}
 }
}
