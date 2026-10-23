import {Injectable,inject,signal} from '@angular/core';import Pusher from 'pusher-js';
import {AuthService} from './auth.service';import {environment} from '../../environments/environment';
@Injectable({providedIn:'root'})export class RealtimeService{
 private auth=inject(AuthService);private client?:Pusher;readonly connected=signal(false);
 connect(deviceIds:string[],onRefresh:()=>void){this.disconnect();if(!environment.pusher.key)return;
  this.client=new Pusher(environment.pusher.key,{cluster:environment.pusher.cluster,channelAuthorization:{transport:'ajax',endpoint:`${environment.api}/realtime/auth`,customHandler:(params,callback)=>{
   this.auth.token().then(token=>fetch(`${environment.api}/realtime/auth`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({socket_id:params.socketId,channel_name:params.channelName})})).then(async r=>{const data=await r.json();if(!r.ok)throw new Error('Realtime authorization failed');callback(null,data)}).catch(e=>callback(e,null));
  }}});
  this.client.connection.bind('connected',()=>{this.connected.set(true);onRefresh()});this.client.connection.bind('disconnected',()=>this.connected.set(false));this.client.connection.bind('error',()=>this.connected.set(false));
  for(const id of new Set(deviceIds)){const c=this.client.subscribe(`private-device-${id}`);for(const e of ['measurement.created','health.updated','alert.created'])c.bind(e,onRefresh)}
 }
 disconnect(){this.client?.disconnect();this.client=undefined;this.connected.set(false)}
}
