import {uiError} from '../core/ui-error';
import {AddDeviceModalService} from '../core/add-device-modal.service';
import {EmptyStateComponent} from './empty-state.component';
import {addIcons} from 'ionicons';
import {addOutline,arrowForwardOutline} from 'ionicons/icons';
import {Component,inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {IonContent,IonHeader,IonToolbar,IonTitle,IonButton,IonRefresher,IonRefresherContent,IonFab,IonFabButton,IonIcon} from '@ionic/angular/standalone';
import {ApiService} from '../core/api.service';
import {AuthService} from '../core/auth.service';
import {ScreenCacheService} from '../core/screen-cache.service';
import {Device,Alert,Page} from '../core/models';
import {RealtimeService} from '../core/realtime.service';
import {PushService} from '../core/push.service';

@Component({standalone:true,
 imports:[CommonModule,RouterLink,IonContent,IonHeader,IonToolbar,IonTitle,IonButton,IonRefresher,IonRefresherContent,IonFab,IonFabButton,IonIcon,EmptyStateComponent],
 templateUrl:'./dashboard.page.html',styleUrls:['./dashboard.page.scss']})
export class DashboardPage{
 readonly addDeviceModal=inject(AddDeviceModalService);
 private api=inject(ApiService);
 private auth=inject(AuthService);
 readonly cache=inject(ScreenCacheService);
 readonly realtime=inject(RealtimeService);
 private push=inject(PushService);
 constructor(){addIcons({addOutline,arrowForwardOutline});}
 devices:Device[]=[];alerts:Alert[]=[];
 busy=true;loadedOnce=false;refreshing=false;error='';updated='';offlineMinutes=60;
 private renderedUid:string|null=null;
 private loadingPromise?:Promise<void>;
 get online(){return this.devices.filter(d=>d.lastSeenAt&&Date.now()-Date.parse(d.lastSeenAt)<this.offlineMinutes*60000).length}
 get oil(){return this.devices.filter(d=>d.latestClassification==='PETROLEUM').length}
 get suspicious(){return this.devices.filter(d=>['INTERFERENCE','INCONCLUSIVE'].includes(d.latestClassification??'')).length}
 get lowBattery(){return this.devices.filter(d=>d.batteryPercent!==undefined&&d.batteryPercent<20).length}
 get maintenance(){return this.devices.filter(d=>d.cellStatus==='MAINTENANCE_REQUIRED').length}
 get recentMeasurements(){return this.devices.filter(d=>d.lastMeasurementAt).sort((a,b)=>Date.parse(b.lastMeasurementAt??'')-Date.parse(a.lastMeasurementAt??'')).slice(0,5)}
 get stale(){return this.cache.isStale('devices')||this.cache.isStale('alerts');}
 async ionViewWillEnter(){await this.reload();await this.push.start();}
 // Realtime lives for the authenticated session; tab switches do not reconnect.
 ionViewWillLeave():void{}
 async reload(event?:any){
  const uid=this.auth.profile()?.uid??null;
  if(this.renderedUid!==uid){
   this.renderedUid=uid;this.devices=[];this.alerts=[];this.loadedOnce=false;this.updated='';
  }
  if(this.loadingPromise){await this.loadingPromise;event?.target?.complete();return;}
  const force=Boolean(event);
  const snapshot= this.cache.hasSnapshot('devices')&&this.cache.hasSnapshot('alerts');
  const needNetwork=force||this.cache.needsNetwork('devices')||this.cache.needsNetwork('alerts');
  this.busy=!snapshot&&!this.loadedOnce;
  this.refreshing=needNetwork&&(snapshot||this.loadedOnce);
  this.error='';
  const task=(async()=>{
   try{
    await Promise.all([
     this.cache.ensure<{items:Device[]}>('devices',()=>firstValueFrom(this.api.devices(force)),data=>{
      if(uid!==this.auth.profile()?.uid)return;
      this.devices=data.items;this.loadedOnce=true;this.busy=false;
      this.updated=new Date(this.cache.lastUpdated('devices')??Date.now()).toISOString();
     },force),
     this.cache.ensure<Page<Alert>>('alerts',()=>firstValueFrom(this.api.alerts(undefined,undefined,force)),data=>{
      if(uid!==this.auth.profile()?.uid)return;
      this.alerts=data.items;this.loadedOnce=true;this.busy=false;
     },force)
    ]);
    this.cache.connectRealtime();
   }catch(e){if(uid===this.auth.profile()?.uid)this.error=uiError(e);}
   finally{this.busy=false;this.refreshing=false;this.loadingPromise=undefined;event?.target?.complete();}
  })();
  this.loadingPromise=task;
  await task;
 }
 async refreshSilent():Promise<void>{
  // Explicitly invoked only by authorized user action, not by Pusher.
  await this.reload({target:{complete:()=>{}}});
 }
}
