import {uiError} from '../core/ui-error';
import {Component,inject} from '@angular/core';import {CommonModule} from '@angular/common';import {RouterLink,ActivatedRoute} from '@angular/router';import {firstValueFrom} from 'rxjs';import {IonContent,IonHeader,IonToolbar,IonTitle,IonButtons,IonBackButton,IonButton} from '@ionic/angular/standalone';import {ApiService} from '../core/api.service';import {AuthService} from '../core/auth.service';import {ScreenCacheService} from '../core/screen-cache.service';import {Alert,Device} from '../core/models';
@Component({standalone:true,imports:[CommonModule,RouterLink,IonContent,IonHeader,IonToolbar,IonTitle,IonButtons,IonBackButton,IonButton],templateUrl:'./alert-detail.page.html',styleUrls:['./alert-detail.page.scss']})export class AlertDetailPage{
 private api=inject(ApiService);readonly auth=inject(AuthService);
 readonly cache=inject(ScreenCacheService);
 id=inject(ActivatedRoute).snapshot.paramMap.get('id')??'';
 alert?:Alert;access='';error='';busy=false;
 private renderedUid:string|null=null;
 private loadedDetailOnce=false;
 get stale(){return this.cache.isStale('alerts')||this.cache.isStale('devices');}
 get canAcknowledge(){
  return this.access==='OWNER'||this.access==='LEGACY_ADMIN'||
   this.access==='LEGACY_VIEWER'&&this.auth.profile()?.role==='OPERATOR';
 }
 async ionViewWillEnter(){await this.load();}
 async load(force=false){
  const uid=this.auth.profile()?.uid??null;
  if(this.renderedUid!==uid){
   this.renderedUid=uid;this.alert=undefined;this.access='';this.loadedDetailOnce=false;this.readMarked=false;
  }
  this.error='';
  const key=`alert:${this.id}` as const;
  try{
   await this.cache.ensure<Alert>(key,()=>firstValueFrom(this.api.alert(this.id)),data=>{
    if(uid!==this.auth.profile()?.uid)return;
    this.alert=data;this.loadedDetailOnce=true;
    const deviceList=this.cache.peek<{items:Device[]}>('devices');
    this.access=deviceList?.items.find(x=>x.id===data.deviceId)?.access??'';
   },force);
   if(uid!==this.auth.profile()?.uid)return;
   if(this.alert){
    // Display permissions are stored only for button presentation; the API
    // always rechecks real ownership before acknowledging the alert.
    await this.cache.ensure<string>(`alert-access:${this.id}`,
     async()=> (await firstValueFrom(this.api.device(this.alert!.deviceId))).access??'',
     access=>{if(uid===this.auth.profile()?.uid)this.access=access;});
   }
   // Read receipt is only sent on the first authenticated detail open in
   // a session; returning to the page never repeats the request.
   if(!this.readMarked){
    this.readMarked=true;
    try{await firstValueFrom(this.api.markRead(this.id));this.cache.markStale(['alerts']);}
    catch{this.readMarked=false;}
   }
  }catch(e){if(uid===this.auth.profile()?.uid)this.error=uiError(e);}
 }
 private readMarked=false;
 async ack(){
  if(this.busy)return;this.busy=true;
  try{
   await firstValueFrom(this.api.acknowledge(this.id));
   this.cache.markStale(['alerts']);await this.load(true);
  }catch(e){this.error=uiError(e);}
  finally{this.busy=false;}
 }
}
