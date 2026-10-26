import {Injectable, inject, signal} from '@angular/core';
import Pusher from 'pusher-js';
import {AuthService} from './auth.service';
import {environment} from '../../environments/environment';

const FALLBACK_POLL_MS = 60_000;

@Injectable({providedIn:'root'})
export class RealtimeService {
 private auth=inject(AuthService);
 private client?:Pusher;
 private fallbackTimer?:ReturnType<typeof setInterval>;
 private generation=0;
 readonly connected=signal(false);

 connect(deviceIds:string[],onRefresh:()=>void):void {
  this.disconnect();
  const generation=this.generation;
  const refresh=()=>{if(generation===this.generation)onRefresh();};
  const beginFallback=()=>{
   if(generation!==this.generation)return;
   this.connected.set(false);
   if(!this.fallbackTimer)this.fallbackTimer=setInterval(refresh,FALLBACK_POLL_MS);
  };
  const stopFallback=()=>{
   if(this.fallbackTimer){clearInterval(this.fallbackTimer);this.fallbackTimer=undefined;}
  };
  // REST is authoritative: continue periodic reconciliation when Pusher is
  // disabled, unavailable or disconnected. An initial REST load is owned by
  // the calling page before connect().
  beginFallback();
  const attach=async()=>{
   let key=environment.pusher.key,cluster=environment.pusher.cluster;
   if(!key){
    try{
     const token=await this.auth.token();
     const response=await fetch(environment.api+'/realtime/config',{
      headers:{Authorization:'Bearer '+token},cache:'no-store'
     });
     if(!response.ok)return;
     const config:unknown=await response.json();
     if(!config||typeof config!=='object')return;
     const value=config as Record<string,unknown>;
     if(value['enabled']!==true||typeof value['key']!=='string'||
        !/^[A-Za-z0-9_-]{5,120}$/.test(value['key'])||
        typeof value['cluster']!=='string'||!/^[a-z0-9-]{2,20}$/.test(value['cluster']))return;
     key=value['key'];cluster=value['cluster'];
    }catch{return}
   }
   if(generation!==this.generation)return;
   try{
   this.client=new Pusher(key,{
    cluster,
    channelAuthorization:{
     transport:'ajax',
     endpoint:`${environment.api}/realtime/auth`,
     customHandler:(params,callback)=>{
      this.auth.token().then(token=>fetch(`${environment.api}/realtime/auth`,{
       method:'POST',
       headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
       body:JSON.stringify({socket_id:params.socketId,channel_name:params.channelName})
      })).then(async r=>{
       const data=await r.json();
       if(!r.ok)throw new Error('Realtime authorization failed');
       callback(null,data);
      }).catch(e=>callback(e,null));
     }
    }
   });
   this.client.connection.bind('connected',()=>{
    if(generation!==this.generation)return;
    stopFallback();
    this.connected.set(true);
    refresh(); // reconcile missed events after every reconnect
   });
   for(const event of ['disconnected','unavailable','failed','error']){
    this.client.connection.bind(event,beginFallback);
   }
   for(const id of new Set(deviceIds)){
    const channel=this.client.subscribe(`private-device-${id}`);
    for(const event of ['measurement.created','health.updated','alert.created','alert.acknowledged']){
     channel.bind(event,refresh);
    }
   }
   const uid=this.auth.profile()?.uid;
   if(uid){
    const userChannel=this.client.subscribe(`private-user-${uid}`);
    userChannel.bind('alert.acknowledged',refresh);
   }
  }catch(error){
   console.warn('Realtime unavailable; continuing REST refresh:',error);
   beginFallback();
  }
  };
  void attach();
 }

 disconnect():void {
  ++this.generation;
  if(this.fallbackTimer){clearInterval(this.fallbackTimer);this.fallbackTimer=undefined;}
  this.client?.disconnect();
  this.client=undefined;
  this.connected.set(false);
 }
}
