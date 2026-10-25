import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

interface PushSession { sessionId:string;sessionSecret:string;expiresAt:string }
@Injectable({ providedIn: 'root' })
export class PushService {
 private readonly api=inject(ApiService);
 private readonly auth=inject(AuthService);
 private readonly router=inject(Router);
 private initialized=false;
 private generation=0;
 private uid?:string;
 private token?:string;
 private session?:PushSession;
 private starting:Promise<void>=Promise.resolve();
 private registrationTask:Promise<void>=Promise.resolve();
 private get nativePushAvailable():boolean{
  return Capacitor.isNativePlatform()&&Capacitor.isPluginAvailable('PushNotifications');
 }
 private installationId():string {
  // Persistent *non-secret* install identifier. Authenticated server sessions
  // and their secrets are never persisted in WebView localStorage.
  const key='blueguard.installation-id.v1';
  let value=globalThis.localStorage.getItem(key);
  if(!value){value='install_'+globalThis.crypto.randomUUID().replaceAll('-','');globalThis.localStorage.setItem(key,value)}
  return value;
 }
 async start():Promise<void>{
  if(!this.nativePushAvailable)return;
  const user=this.auth.currentUser();
  if(!user||!user.emailVerified)return;
  if(this.initialized&&this.uid===user.uid){
   if(this.session)try{await firstValueFrom(this.api.refreshPushSession(this.session.sessionId,this.session.sessionSecret))}
    catch{await this.stop();return this.start()}
   return;
  }
  if(this.initialized)await this.stop();
  this.initialized=true;
  this.uid=user.uid;
  const gen=++this.generation;
  this.starting=this.activate(gen,user.uid);
  await this.starting;
 }
 private async activate(gen:number,uid:string):Promise<void>{
  try{
   const permission=await PushNotifications.requestPermissions();
   if(gen!==this.generation)return;
   if(permission.receive!=='granted'){this.initialized=false;return}
   const session=await firstValueFrom(this.api.startPushSession(this.installationId()));
   // Retain even after logout race so stop() can revoke it.
   this.session=session;
   if(gen!==this.generation||this.auth.currentUser()?.uid!==uid)return;
   await PushNotifications.addListener('registration',({value})=>{
    this.registrationTask=this.registrationTask.catch(()=>undefined).then(async()=>{
     if(gen!==this.generation||this.auth.currentUser()?.uid!==uid||!value||value===this.token)return;
     const current=this.session,previous=this.token;
     if(!current)return;
     try{
      await firstValueFrom(this.api.registerToken(value,current.sessionId,current.sessionSecret));
      if(gen!==this.generation||this.auth.currentUser()?.uid!==uid)return;
      this.token=value;
      if(previous&&previous!==value)await firstValueFrom(this.api.unregisterToken(previous));
     }catch{ /* The next registration or sign-in may retry. Do not log token. */ }
    });
   });
   if(gen!==this.generation)return;
   await PushNotifications.addListener('registrationError',()=>{});
   if(gen!==this.generation)return;
   await PushNotifications.addListener('pushNotificationActionPerformed',event=>{
    if(gen!==this.generation||this.auth.currentUser()?.uid!==uid)return;
    const data=event.notification.data,alertId=data?.['alertId'];
    if(typeof alertId==='string'&&alertId)void this.router.navigate(['/tabs/alerts',alertId]);
    else if(typeof data?.['deviceId']==='string'&&data['deviceId'])
     void this.router.navigate(['/tabs/buoys',data['deviceId']]);
   });
   if(gen!==this.generation)return;
   await PushNotifications.register();
  }catch{
   if(gen===this.generation){this.initialized=false;/* App stays usable without push. */}
  }
 }
 async stop():Promise<void>{
  ++this.generation;
  this.initialized=false;
  this.uid=undefined;
  await this.starting.catch(()=>undefined);
  await this.registrationTask.catch(()=>undefined);
  const token=this.token,session=this.session;
  this.token=undefined;this.session=undefined;
  if(token&&this.nativePushAvailable)try{await firstValueFrom(this.api.unregisterToken(token))}catch{ /* offline logout; server still checks session */ }
  if(session)try{await firstValueFrom(this.api.endPushSession(session.sessionId,session.sessionSecret))}
   catch{ /* Offline logout cannot immediately revoke server state. Replacing same installation invalidates it on next online sign-in. */ }
  if(this.nativePushAvailable)try{await PushNotifications.removeAllListeners()}catch{}
 }
}
