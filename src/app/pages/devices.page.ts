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
import {RealtimeService} from '../core/realtime.service';
import {Device} from '../core/models';
@Component({standalone:true,imports:[CommonModule,FormsModule,RouterLink,IonContent,IonHeader,IonToolbar,IonTitle,IonButton,IonSearchbar,IonSelect,IonSelectOption,IonRefresher,IonRefresherContent,IonFab,IonFabButton,IonIcon,EmptyStateComponent],templateUrl:'./devices.page.html',styleUrls:['./devices.page.scss']})
export class DevicesPage{
 readonly addDeviceModal=inject(AddDeviceModalService);
 constructor(){addIcons({addOutline});}
 private api=inject(ApiService);private auth=inject(AuthService);
 private realtime=inject(RealtimeService);
 private active=false;
 items:Device[]=[];invitations:{deviceId:string;invitedAt:string}[]=[];transfers:{deviceId:string;requestId:string;expiresAt:string}[]=[];term='';filter='ALL';loading=true;loadedOnce=false;error='';accepting='';
 private inFlight=false;
 onSearch(value: string | null | undefined):void{this.term=value??''}
 onlineLabel(d:Device):string{if(d.status==='DISABLED')return 'Disabled';if(!d.lastSeenAt)return 'Not yet online';const age=Date.now()-Date.parse(d.lastSeenAt);return Number.isFinite(age)&&age>=0&&age<60*60*1000?'Online':'Offline'}
 get shown(){return this.items.filter(d=>(d.name+' '+d.id).toLowerCase().includes(this.term.toLowerCase())&&(this.filter==='ALL'||d.latestClassification===this.filter))}
 get owned(){return this.shown.filter(d=>d.access==='OWNER')}
 get shared(){return this.shown.filter(d=>d.access==='VIEWER')}
 get legacy(){return this.shown.filter(d=>d.access!=='OWNER'&&d.access!=='VIEWER')}
 async ionViewWillEnter(){
  this.active=true;
  await this.load();
  if(this.active)this.realtime.connect(this.items.map(item=>item.id),()=>{
   if(this.active&&!this.loading&&!this.accepting)void this.load(undefined,true);
  });
 }
 ionViewWillLeave(){this.active=false;this.realtime.disconnect()}
 async load(event?:any,forceFresh=false){
  if(this.inFlight){event?.target?.complete();return;}
  this.inFlight=true;this.loading=true;this.error='';
  try{
   const fresh=forceFresh||Boolean(event);
   // The three endpoints are independent: do not pay their network latency
   // serially. Keep previously rendered results visible until replacement.
   const [devices,invitations,transfers]=await Promise.all([
    firstValueFrom(this.api.devices(fresh)),
    firstValueFrom(this.api.invitations(fresh)).catch(()=>({items:[]})),
    firstValueFrom(this.api.incomingTransfers(fresh)).catch(()=>({items:[]}))
   ]);
   this.items=devices.items;
   this.invitations=invitations.items;
   this.transfers=transfers.items;
  }catch(e){this.error=uiError(e);}
  finally{this.loading=false;this.loadedOnce=true;this.inFlight=false;event?.target?.complete();}
 }
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
