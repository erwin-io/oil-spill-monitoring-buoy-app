import {Injectable,inject,signal} from '@angular/core';
import {AuthService} from './auth.service';
import {RealtimeService} from './realtime.service';

// Only these read-only screen snapshots are persisted, never JWTs, passwords,
// device upload keys, claim codes, or Firebase email action credentials.
export type ScreenKey='devices'|'alerts'|'invitations'|'transfers'|`alert:${string}`|`alert-access:${string}`;
interface Snapshot<T=unknown>{
 key:string;
 uid:string;
 schema:number;
 storedAt:number;
 data:T;
}
const DB_NAME='blueguard-screen-snapshots';
const STORE='snapshots';
const SCHEMA=1;
const MAX_AGE_MS=7*24*60*60*1000;
const MAX_SNAPSHOTS=80;
const MAX_ENTRY_BYTES=256*1024;
const MAX_TOTAL_BYTES=12*1024*1024;

function transactionResult<T>(request:IDBRequest<T>):Promise<T>{
 return new Promise((resolve,reject)=>{
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error??new Error('IndexedDB request failed'));
 });
}

// IndexedDB is best-effort. On browsers with unavailable/evicted/blocked
// storage, the app remains functional through the in-memory cache and API.
@Injectable({providedIn:'root'})
export class ScreenCacheService{
 private auth=inject(AuthService);
 private realtime=inject(RealtimeService);
 private database?:Promise<IDBDatabase|null>;
 private currentUid:string|null=null;
 private entries=new Map<ScreenKey,Snapshot>();
 private loaded=new Set<ScreenKey>();
 private pending=new Map<ScreenKey,Promise<unknown>>();
 private hydratePending=new Map<ScreenKey,Promise<unknown>>();
 private stale=new Set<ScreenKey>();
 private subscribedIds='';
 private subscribedUid:string|null=null;
 private writes=new Set<Promise<void>>();
 readonly version=signal(0);

 constructor(){
  if(typeof window!=='undefined'){
   window.addEventListener('blueguard:session-ended',()=>{
    const uid=this.auth.profile()?.uid??this.currentUid;
    this.clearMemory();this.currentUid=null;
    // Wait for any already-started IndexedDB write before purging, otherwise
    // an out-of-order write could recreate an offline snapshot after logout.
    const pending=[...this.writes];
    if(uid)void Promise.allSettled(pending).then(()=>this.purge(uid));
   });
  }
 }
 private emit(){this.version.update(v=>v+1);}
 private identity():string|null{
  const uid=this.auth.profile()?.uid??null;
  if(uid!==this.currentUid){
   // An Ionic tab page can survive sign-out or an account switch.
   // No record from another UID is ever returned.
   this.clearMemory();
   this.currentUid=uid;
  }
  return uid;
 }
 private clearMemory(){
  this.entries.clear();this.loaded.clear();this.pending.clear();
  this.hydratePending.clear();this.stale.clear();
  this.subscribedIds='';this.subscribedUid=null;
  this.realtime.disconnect();
  this.emit();
 }
 private async db():Promise<IDBDatabase|null>{
  if(this.database)return this.database;
  if(typeof indexedDB==='undefined')return null;
  this.database=new Promise(resolve=>{
   try{
    const req=indexedDB.open(DB_NAME,SCHEMA);
    req.onupgradeneeded=()=>{
     const db=req.result;
     if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'key'});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>resolve(null);
    req.onblocked=()=>resolve(null);
   }catch{resolve(null);}
  });
  return this.database;
 }
 private storageKey(uid:string,key:ScreenKey){return uid+'|'+key;}
 private async read<T>(uid:string,key:ScreenKey):Promise<Snapshot<T>|undefined>{
  try{
   const db=await this.db();if(!db)return;
   const row=await transactionResult(db.transaction(STORE,'readonly')
    .objectStore(STORE).get(this.storageKey(uid,key))) as Snapshot<T>|undefined;
   if(!row||row.uid!==uid||row.schema!==SCHEMA||
       !Number.isFinite(row.storedAt)||Date.now()-row.storedAt>MAX_AGE_MS)return;
   return row;
  }catch{return;}
 }
 private async save<T>(row:Snapshot<T>):Promise<void>{
  try{
   const serialized=JSON.stringify(row);
   if(serialized.length>MAX_ENTRY_BYTES)return;
   const db=await this.db();if(!db)return;
   const tx=db.transaction(STORE,'readwrite');
   tx.objectStore(STORE).put(row);
   await new Promise<void>((resolve,reject)=>{
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
    tx.onabort=()=>reject(tx.error);
   });
   // Purge old/oversized records, including abandoned accounts. This is a
   // bounded snapshot store, not an unbounded telemetry/alert archive.
   await this.prune(db);
  }catch{/* QuotaExceededError / private WebView: memory cache remains usable. */}
 }
 private async prune(db:IDBDatabase):Promise<void>{
  try{
   const records=await transactionResult(db.transaction(STORE,'readonly')
    .objectStore(STORE).getAll()) as Snapshot[];
   const sorted=records.map(r=>({key:r.key,at:r.storedAt,
    bytes:JSON.stringify(r).length})).sort((a,b)=>b.at-a.at);
   let count=0,size=0;
   const remove:string[]=[];
   for(const row of sorted){
    if(!Number.isFinite(row.at)||Date.now()-row.at>MAX_AGE_MS||
       count>=MAX_SNAPSHOTS||size+row.bytes>MAX_TOTAL_BYTES){remove.push(row.key);continue;}
    count++;size+=row.bytes;
   }
   if(!remove.length)return;
   const tx=db.transaction(STORE,'readwrite');
   const store=tx.objectStore(STORE);
   for(const key of remove)store.delete(key);
  }catch{/* Best effort eviction. */}
 }
 private async purge(uid:string):Promise<void>{
  try{
   const db=await this.db();if(!db)return;
   const store=db.transaction(STORE,'readonly').objectStore(STORE);
   const keys=await transactionResult(store.getAllKeys());
   const tx=db.transaction(STORE,'readwrite');
   for(const key of keys)if(typeof key==='string'&&key.startsWith(uid+'|'))
    tx.objectStore(STORE).delete(key);
  }catch{/* Storage absence never prevents logout. */}
 }
 peek<T>(key:ScreenKey):T|undefined{
  const uid=this.identity();
  if(!uid)return;
  const entry=this.entries.get(key);
  return entry?.uid===uid?entry.data as T:undefined;
 }
 hasSnapshot(key:ScreenKey):boolean{
  this.identity();return this.entries.has(key);
 }
 isStale(key:ScreenKey):boolean{
  this.identity();this.version();return this.stale.has(key);
 }
 lastUpdated(key:ScreenKey):number|undefined{
  this.identity();return this.entries.get(key)?.storedAt;
 }
 needsNetwork(key:ScreenKey):boolean{
  this.identity();return !this.loaded.has(key);
 }
 async hydrate<T>(key:ScreenKey):Promise<T|undefined>{
  const uid=this.identity();
  if(!uid)return;
  if(this.entries.has(key))return this.peek<T>(key);
  const existing=this.hydratePending.get(key);
  if(existing)return existing as Promise<T|undefined>;
  const work=(async()=>{
   const row=await this.read<T>(uid,key);
   if(uid===this.identity()&&row&&!this.entries.has(key)){
    this.entries.set(key,row);this.emit();
    if(key==='devices')this.connectRealtime();
   }
   return uid===this.identity()?this.peek<T>(key):undefined;
  })();
  this.hydratePending.set(key,work);
  try{return await work;}finally{
   if(this.hydratePending.get(key)===work)this.hydratePending.delete(key);
  }
 }
 async fetch<T>(key:ScreenKey,loader:()=>Promise<T>,force=false):Promise<T>{
  const uid=this.identity();
  if(!uid)throw new Error('Sign in required');
  const inflight=this.pending.get(key);
  if(inflight){
   // A manual refresh arriving during the initial load joins that load;
   // subsequent explicit refresh can be requested after it completes.
   return inflight as Promise<T>;
  }
  if(!force&&this.loaded.has(key)&&this.entries.has(key))
   return this.entries.get(key)!.data as T;
  const task=(async()=>{
   const value=await loader();
   if(uid!==this.identity())throw new Error('Account changed during loading');
   const row:Snapshot<T>={key:this.storageKey(uid,key),uid,schema:SCHEMA,
    storedAt:Date.now(),data:value};
   this.entries.set(key,row);
   this.loaded.add(key);
   this.stale.delete(key);
   this.emit();
   const write=this.save(row);
   this.writes.add(write);
   void write.finally(()=>this.writes.delete(write));
   if(key==='devices')this.connectRealtime();
   return value;
  })();
  this.pending.set(key,task);
  try{return await task;}finally{
   if(this.pending.get(key)===task)this.pending.delete(key);
  }
 }
 async ensure<T>(key:ScreenKey,loader:()=>Promise<T>,
  onData:(data:T,fromDisk:boolean)=>void,force=false):Promise<void>{
  const uid=this.identity();
  if(!uid)throw new Error('Sign in required');
  const snapshot=await this.hydrate<T>(key);
  if(uid!==this.identity())return;
  if(snapshot!==undefined)onData(snapshot,true);
  if(!force&&this.loaded.has(key))return;
  const fresh=await this.fetch(key,loader,force);
  if(uid===this.identity())onData(fresh,false);
 }
 markStale(keys:ScreenKey[]=['devices','alerts','invitations','transfers']){
  if(!this.identity())return;
  keys.forEach(k=>this.stale.add(k));
  this.emit();
 }
 // One Pusher session per user/device membership. Switching Ionic tabs never
 // disconnects/reconnects or triggers a second API configuration request.
 connectRealtime():void{
  const uid=this.identity();
  if(!uid)return;
  const devices=this.peek<{items:{id:string}[]}>('devices');
  const ids=(devices?.items??[]).map(d=>d.id).sort();
  const key=ids.join('|');
  if(this.subscribedUid===uid&&this.subscribedIds===key)return;
  this.subscribedUid=uid;this.subscribedIds=key;
  this.realtime.connect(ids,()=>{
   // New server data is available. No full GET on tab switching or Pusher.
   // Read receipts, ownership changes and alerts are reconciled on manual
   // refresh; never grant an action from this cached display.
   this.markStale();
  });
 }
 async clearOnLogout():Promise<void>{
  const uid=this.auth.profile()?.uid??this.currentUid;
  this.clearMemory();
  this.currentUid=null;
  // A pending persistence write must not recreate a just-cleared snapshot.
  await Promise.allSettled([...this.writes]);
  if(uid)await this.purge(uid);
 }
 async update<T>(key:ScreenKey,data:T):Promise<void>{
  const uid=this.identity();if(!uid)return;
  const row:Snapshot<T>={key:this.storageKey(uid,key),uid,
   schema:SCHEMA,storedAt:Date.now(),data};
  this.entries.set(key,row);this.loaded.add(key);this.emit();
  const write=this.save(row);this.writes.add(write);
  try{await write;}finally{this.writes.delete(write);}
 }
}
