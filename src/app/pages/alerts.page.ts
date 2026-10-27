import {uiError} from '../core/ui-error';
import {EmptyStateComponent} from './empty-state.component';
import {Component,inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {IonContent,IonHeader,IonToolbar,IonTitle,IonButton,IonRefresher,IonRefresherContent,IonButtons,IonIcon} from '@ionic/angular/standalone';
import {ApiService} from '../core/api.service';
import {AuthService} from '../core/auth.service';
import {ScreenCacheService} from '../core/screen-cache.service';
import {Device,Alert,Page} from '../core/models';
import {addIcons} from 'ionicons';
import {checkmarkDoneOutline} from 'ionicons/icons';

@Component({standalone:true,
 imports:[CommonModule,RouterLink,IonContent,IonHeader,IonToolbar,IonTitle,IonButton,IonRefresher,IonRefresherContent,IonButtons,IonIcon,EmptyStateComponent],
 templateUrl:'./alerts.page.html',styleUrls:['./alerts.page.scss']})
export class AlertsPage{
 constructor(){addIcons({checkmarkDoneOutline});}
 private api=inject(ApiService);private auth=inject(AuthService);
 readonly cache=inject(ScreenCacheService);
 private renderedUid:string|null=null;
 private loadingPromise?:Promise<void>;
 items:Alert[]=[];cursor:string|null=null;openCount=0;unreadCount=0;
 loading=true;loadedOnce=false;marking=false;error='';
 deviceNames:Record<string,string>={};
 get stale(){return this.cache.isStale('alerts')||this.cache.isStale('devices');}
 nameOf(a:Alert){return a.deviceName||this.deviceNames[a.deviceId]||a.deviceId}
 async ionViewWillEnter(){await this.load();}
 ionViewWillLeave():void{}
 async load(event?:any,forceFresh=false){
  const uid=this.auth.profile()?.uid??null;
  if(this.renderedUid!==uid){
   this.renderedUid=uid;this.items=[];this.cursor=null;this.openCount=0;
   this.unreadCount=0;this.deviceNames={};this.loadedOnce=false;
  }
  if(this.loadingPromise){await this.loadingPromise;event?.target?.complete();return;}
  const force=forceFresh||Boolean(event);
  const snapshot=this.cache.hasSnapshot('alerts');
  this.loading=!snapshot&&!this.loadedOnce;this.error='';
  const task=(async()=>{
   try{
    await Promise.all([
     this.cache.ensure<Page<Alert>>('alerts',()=>firstValueFrom(this.api.alerts(undefined,undefined,force)),page=>{
      if(uid!==this.auth.profile()?.uid)return;
      this.items=page.items;this.cursor=page.nextCursor;this.openCount=page.openCount??0;
      this.unreadCount=page.unreadCount??0;this.loadedOnce=true;this.loading=false;
     },force),
     this.cache.ensure<{items:Device[]}>('devices',()=>firstValueFrom(this.api.devices(force)),data=>{
      if(uid===this.auth.profile()?.uid){
       this.deviceNames=Object.fromEntries(data.items.map(x=>[x.id,x.name]));
      }
     },force)
    ]);
    this.cache.connectRealtime();
   }catch(e){if(uid===this.auth.profile()?.uid)this.error=uiError(e);}
   finally{this.loading=false;this.loadingPromise=undefined;event?.target?.complete();}
  })();
  this.loadingPromise=task;await task;
 }
 async more(){
  if(!this.cursor||this.loading)return;
  const uid=this.auth.profile()?.uid;this.loading=true;
  try{
   const page=await firstValueFrom(this.api.alerts(this.cursor));
   if(uid!==this.auth.profile()?.uid)return;
   const ids=new Set(this.items.map(x=>x.id));
   this.items=[...this.items,...page.items.filter(x=>!ids.has(x.id))];
   this.cursor=page.nextCursor;this.error='';
   await this.cache.update<Page<Alert>>('alerts',{items:this.items,nextCursor:this.cursor,
    unreadCount:this.unreadCount,openCount:this.openCount});
  }catch(e){if(uid===this.auth.profile()?.uid)this.error=uiError(e);}
  finally{this.loading=false;}
 }
 async markAll(){
  if(this.marking||this.loading)return;
  const uid=this.auth.profile()?.uid;this.marking=true;this.error='';
  try{
   await firstValueFrom(this.api.markAllRead());
   if(uid===this.auth.profile()?.uid){this.cache.markStale(['alerts']);await this.load(undefined,true);}
  }catch(e){if(uid===this.auth.profile()?.uid)this.error=uiError(e);}
  finally{this.marking=false;}
 }
}
