import {uiError} from '../core/ui-error';
import {AddDeviceModalService} from '../core/add-device-modal.service';
import {EmptyStateComponent} from './empty-state.component';
import {addIcons} from 'ionicons';
import {addOutline,arrowForwardOutline} from 'ionicons/icons';
import {Component,inject} from '@angular/core';import {CommonModule} from '@angular/common';import {RouterLink} from '@angular/router';import {firstValueFrom} from 'rxjs';import {IonContent,IonHeader,IonToolbar,IonTitle,IonButton,IonRefresher,IonRefresherContent,IonFab,IonFabButton,IonIcon} from '@ionic/angular/standalone';
import {ApiService} from '../core/api.service';import {Device,Alert} from '../core/models';import {RealtimeService} from '../core/realtime.service';import {PushService} from '../core/push.service';
@Component({standalone:true,imports:[CommonModule,RouterLink,IonContent,IonHeader,IonToolbar,IonTitle,IonButton,IonRefresher,IonRefresherContent,IonFab,IonFabButton,IonIcon,EmptyStateComponent],templateUrl:'./dashboard.page.html',styleUrls:['./dashboard.page.scss']})export class DashboardPage {
 readonly addDeviceModal=inject(AddDeviceModalService);
 constructor(){addIcons({addOutline,arrowForwardOutline});}
 private api=inject(ApiService);readonly realtime=inject(RealtimeService);private push=inject(PushService);
 devices:Device[]=[];alerts:Alert[]=[];busy=true;error='';updated='';offlineMinutes=60;
 loadedOnce=false;refreshing=false;
 private loadingPromise?:Promise<void>;
 get online(){return this.devices.filter(d=>d.lastSeenAt&&Date.now()-Date.parse(d.lastSeenAt)<this.offlineMinutes*60000).length}
 get oil(){return this.devices.filter(d=>d.latestClassification==='PETROLEUM').length}
 get suspicious(){return this.devices.filter(d=>['INTERFERENCE','INCONCLUSIVE'].includes(d.latestClassification??'')).length}
 get lowBattery(){return this.devices.filter(d=>d.batteryPercent!==undefined&&d.batteryPercent<20).length}
 get maintenance(){return this.devices.filter(d=>d.cellStatus==='MAINTENANCE_REQUIRED').length}
 get recentMeasurements(){return this.devices.filter(d=>d.lastMeasurementAt).sort((a,b)=>Date.parse(b.lastMeasurementAt??'')-Date.parse(a.lastMeasurementAt??'')).slice(0,5)}
 async ionViewWillEnter(){await this.reload();await this.push.start()}
 ionViewWillLeave(){this.realtime.disconnect()}
 async reload(event?:any){
  if(this.loadingPromise){await this.loadingPromise;event?.target?.complete();return;}
  // Retain an already loaded dashboard while refreshing, even for zero buoys.
  // Never blank the screen just because a network round trip is ongoing.
  this.busy=!this.loadedOnce;this.refreshing=this.loadedOnce;this.error='';
  const task=(async()=>{
   try{
    const fresh=Boolean(event);
    const [devices,alerts]=await Promise.all([
     firstValueFrom(this.api.devices(fresh)),
     firstValueFrom(this.api.alerts(undefined,undefined,fresh))
    ]);
    this.devices=devices.items;this.alerts=alerts.items;
    this.realtime.connect(devices.items.map(v=>v.id),()=>{void this.refreshSilent()});
    this.updated=new Date().toISOString();
   }catch(e){this.error=uiError(e);}
   finally{this.loadedOnce=true;this.busy=false;this.refreshing=false;event?.target?.complete();this.loadingPromise=undefined;}
  })();
  this.loadingPromise=task;
  await task;
 }
 async refreshSilent(){
  if(this.refreshing||this.busy)return;
  this.refreshing=true;
  try{
   const previousIds=this.devices.map(x=>x.id).sort().join('|');
   const [devices,alerts]=await Promise.all([
    firstValueFrom(this.api.devices(true)),
    firstValueFrom(this.api.alerts(undefined,undefined,true))
   ]);
   this.devices=devices.items;this.alerts=alerts.items;
   this.updated=new Date().toISOString();this.error='';
   const currentIds=devices.items.map(x=>x.id).sort().join('|');
   if(previousIds!==currentIds)this.realtime.connect(devices.items.map(x=>x.id),()=>{void this.refreshSilent()});
  }catch(e){this.error=uiError(e)+' Last loaded data may be stale.';}
  finally{this.refreshing=false;}
 }
}
