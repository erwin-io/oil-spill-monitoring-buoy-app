import {uiError} from '../core/ui-error';
import {EmptyStateComponent} from './empty-state.component';
import {Component,inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {IonContent,IonHeader,IonToolbar,IonTitle,IonButton,IonRefresher,IonRefresherContent,IonButtons,IonIcon} from '@ionic/angular/standalone';
import {ApiService} from '../core/api.service';
import {AuthService} from '../core/auth.service';
import {RealtimeService} from '../core/realtime.service';
import {Alert} from '../core/models';
import {addIcons} from 'ionicons';
import {checkmarkDoneOutline} from 'ionicons/icons';
@Component({standalone:true,imports:[CommonModule,RouterLink,IonContent,IonHeader,IonToolbar,IonTitle,IonButton,IonRefresher,IonRefresherContent,IonButtons,IonIcon,EmptyStateComponent],
 templateUrl:'./alerts.page.html',styleUrls:['./alerts.page.scss']})
export class AlertsPage{
 constructor(){addIcons({checkmarkDoneOutline});}
 private api=inject(ApiService);private auth=inject(AuthService);
 private realtime=inject(RealtimeService);
 private active=false;
 private renderedUid:string|null=null;
 items:Alert[]=[];cursor:string|null=null;openCount=0;unreadCount=0;loading=true;loadedOnce=false;marking=false;error='';
 deviceNames:Record<string,string>={};
 private generation=0;
 nameOf(a:Alert){return a.deviceName||this.deviceNames[a.deviceId]||a.deviceId}
 async ionViewWillEnter(){
  this.active=true;
  await this.load();
  if(this.active)this.realtime.connect(Object.keys(this.deviceNames),()=>{
   if(this.active&&!this.loading&&!this.marking)void this.load(undefined,true);
  });
 }
 ionViewWillLeave(){this.active=false;this.generation++;this.realtime.disconnect()}
 async load(e?:any,forceFresh=false){
  const gen=++this.generation,uid=this.auth.profile()?.uid;
  if(this.renderedUid!==(uid??null)){
   this.renderedUid=uid??null;this.items=[];this.cursor=null;this.openCount=0;
   this.unreadCount=0;this.deviceNames={};this.loadedOnce=false;
  }
  this.loading=true;
  try{
   const fresh=forceFresh||Boolean(e);
   // Alerts and buoy names do not depend on each other. Fetch both
   // concurrently and keep the previous notification list visible.
   const [page,devices]=await Promise.all([
    firstValueFrom(this.api.alerts(undefined,undefined,fresh)),
    firstValueFrom(this.api.devices(fresh)).catch(()=>null)
   ]);
   if(gen!==this.generation||uid!==this.auth.profile()?.uid)return;
   this.items=page.items;this.cursor=page.nextCursor;
   this.openCount=page.openCount??0;this.unreadCount=page.unreadCount??0;
   if(devices)this.deviceNames=Object.fromEntries(devices.items.map(x=>[x.id,x.name]));
   this.error='';
  }catch(x){if(gen===this.generation&&uid===this.auth.profile()?.uid)this.error=uiError(x);}
  finally{
   if(gen===this.generation){this.loading=false;this.loadedOnce=true;}
   e?.target?.complete();
  }
 }
 async more(){
  if(!this.cursor||this.loading)return;
  const gen=this.generation,uid=this.auth.profile()?.uid;this.loading=true;
  try{
   const page=await firstValueFrom(this.api.alerts(this.cursor));
   if(gen!==this.generation||uid!==this.auth.profile()?.uid)return;
   const ids=new Set(this.items.map(x=>x.id));
   this.items.push(...page.items.filter(x=>!ids.has(x.id)));
   this.cursor=page.nextCursor;this.error='';
  }catch(x){if(gen===this.generation&&uid===this.auth.profile()?.uid)this.error=uiError(x)}
  finally{if(gen===this.generation)this.loading=false}
 }
 async markAll(){
  if(this.marking||this.loading)return;
  const uid=this.auth.profile()?.uid;this.marking=true;this.error='';
  try{
   await firstValueFrom(this.api.markAllRead());
   if(uid===this.auth.profile()?.uid)await this.load();
  }catch(e){if(uid===this.auth.profile()?.uid)this.error=uiError(e)}
  finally{this.marking=false}
 }
}
