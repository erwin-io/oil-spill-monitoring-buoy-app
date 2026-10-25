import {uiError} from '../core/ui-error';
import {EmptyStateComponent} from './empty-state.component';
import {Component,inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {IonContent,IonHeader,IonToolbar,IonTitle,IonButton,IonRefresher,IonRefresherContent} from '@ionic/angular/standalone';
import {ApiService} from '../core/api.service';
import {AuthService} from '../core/auth.service';
import {Alert} from '../core/models';
@Component({standalone:true,imports:[CommonModule,RouterLink,IonContent,IonHeader,IonToolbar,IonTitle,IonButton,IonRefresher,IonRefresherContent,EmptyStateComponent],
 templateUrl:'./alerts.page.html',styleUrls:['./alerts.page.scss']})
export class AlertsPage{
 private api=inject(ApiService);private auth=inject(AuthService);
 items:Alert[]=[];cursor:string|null=null;openCount=0;unreadCount=0;loading=true;marking=false;error='';
 deviceNames:Record<string,string>={};
 private generation=0;
 nameOf(a:Alert){return a.deviceName||this.deviceNames[a.deviceId]||a.deviceId}
 async ionViewWillEnter(){await this.load()}
 async load(e?:any){
  const gen=++this.generation,uid=this.auth.profile()?.uid;
  this.items=[];this.cursor=null;this.openCount=0;this.unreadCount=0;this.deviceNames={};this.loading=true;
  try{
   const page=await firstValueFrom(this.api.alerts());
   if(gen!==this.generation||uid!==this.auth.profile()?.uid)return;
   this.items=page.items;this.cursor=page.nextCursor;this.openCount=page.openCount??0;
   this.unreadCount=page.unreadCount??0;this.error='';
   try{
    const d=await firstValueFrom(this.api.devices());
    if(gen===this.generation&&uid===this.auth.profile()?.uid)
     this.deviceNames=Object.fromEntries(d.items.map(x=>[x.id,x.name]));
   }catch{/* Inbox works without device names */}
  }catch(x){if(gen===this.generation&&uid===this.auth.profile()?.uid)this.error=uiError(x)}
  finally{if(gen===this.generation)this.loading=false;e?.target?.complete()}
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
