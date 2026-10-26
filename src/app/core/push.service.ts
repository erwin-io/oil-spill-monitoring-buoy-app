import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { firstValueFrom } from 'rxjs';
import {ToastController} from '@ionic/angular/standalone';
import {notificationDestination} from './notification-destination';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

interface PushSession { sessionId:string;sessionSecret:string;expiresAt:string }
@Injectable({ providedIn: 'root' })
export class PushService {
 private readonly api=inject(ApiService);
 private readonly auth=inject(AuthService);
 private readonly router=inject(Router);
 private readonly toasts=inject(ToastController);
 private initialized=false;
 private generation=0;
 private uid?:string;
 private token?:string;
 private session?:PushSession;
 private starting:Promise<void>=Promise.resolve();
 private registrationTask:Promise<void>=Promise.resolve();
 private foregroundTask:Promise<void>=Promise.resolve();
 private foregroundToast?:HTMLIonToastElement;
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
      if(gen!==this.generation||this.auth.currentUser()?.uid!==uid){
       // stop() waits for this registration task while the old Firebase user
       // is still authenticated; retire a late token before signing out.
       try{await firstValueFrom(this.api.unregisterToken(value))}catch{}
       return;
      }
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
    void this.router.navigate(notificationDestination(event.notification.data));
   });
   if(gen!==this.generation)return;
   await PushNotifications.addListener('pushNotificationReceived',event=>{
    if(gen!==this.generation||this.auth.currentUser()?.uid!==uid)return;
    this.foregroundTask=this.foregroundTask.catch(()=>undefined).then(async()=>{
     if(gen!==this.generation||this.auth.currentUser()?.uid!==uid)return;
     const previous=this.foregroundToast;
     this.foregroundToast=undefined;
     if(previous)try{await previous.dismiss()}catch{}
     if(gen!==this.generation||this.auth.currentUser()?.uid!==uid)return;
     const destination=notificationDestination(event.data);
     const title=typeof event.title==='string'?event.title.slice(0,90):'BlueGuard notification';
     const body=typeof event.body==='string'?event.body.slice(0,180):'A buoy notification arrived.';
     const toast=await this.toasts.create({
      header:title,message:body,position:'top',duration:8000,
      buttons:[
       {text:'View',handler:()=>{
        if(gen===this.generation&&this.auth.currentUser()?.uid===uid)
         void this.router.navigate(destination);
       }},
       {text:'Dismiss',role:'cancel'}
      ]
     });
     if(gen!==this.generation||this.auth.currentUser()?.uid!==uid){
      try{await toast.dismiss()}catch{}
      return;
     }
     this.foregroundToast=toast;
     await toast.present();
    });
   });
   if(gen!==this.generation)return;
   await PushNotifications.register();
  }catch{
   if(gen===this.generation){this.initialized=false;/* App stays usable without push. */}
  }
 }
 async stop(requireServerRevocation=false):Promise<void>{
  ++this.generation;
  this.initialized=false;
  this.uid=undefined;
  await this.starting.catch(()=>undefined);
  await this.registrationTask.catch(()=>undefined);
  await this.foregroundTask.catch(()=>undefined);
  const displayed=this.foregroundToast;this.foregroundToast=undefined;
  if(displayed)try{await displayed.dismiss()}catch{}
  const token=this.token,session=this.session;
  if(session&&requireServerRevocation){
   try{await firstValueFrom(this.api.endPushSession(session.sessionId,session.sessionSecret));}
   catch{
    // Keep the in-memory session proof and authenticated Firebase account for retry.
    // Never persist this secret to WebView storage and never claim remote logout succeeded.
    if(this.nativePushAvailable)try{await PushNotifications.removeAllListeners()}catch{}
    throw new Error('Cannot sign out securely while offline. Reconnect and retry to revoke notifications.');
   }
  }
  this.token=undefined;this.session=undefined;
  if(token&&this.nativePushAvailable)try{await firstValueFrom(this.api.unregisterToken(token))}catch{
   // Revoked session prevents future FCM dispatch even if the token delete failed.
  }
  if(session&&!requireServerRevocation)try{await firstValueFrom(this.api.endPushSession(session.sessionId,session.sessionSecret))}
   catch{ /* Account switch on reconnect replaces the old installation session. */ }
  if(this.nativePushAvailable)try{await PushNotifications.removeAllListeners()}catch{}
 }
}
