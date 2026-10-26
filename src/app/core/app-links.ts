import {environment} from '../../environments/environment';

// No tokens or permissions in a URL. The API remains authoritative for Viewer/Owner.
const KEY='blueguard.pending-link.v1';
export function appLinkDestination(raw:string):string|null{
 if(!raw||raw.length>1024)return null;
 try{
  const url=new URL(raw);
  if(url.protocol!=='https:'||url.host!==environment.firebase.authDomain||
   url.username||url.password||url.hash)return null;
  // The Firebase-hosted action handler has already completed verification/reset.
  // Never accept a status flag, action code or UID as evidence via this link.
  if(url.pathname==='/open/email-verified'||url.pathname==='/open/password-reset-complete'){
    if(url.search)return null;
    return url.pathname==='/open/email-verified'?'/verify-email':'/login';
  }
  if(url.pathname!=='/open/invite'&&url.pathname!=='/open/transfer')return null;
  const ids=url.searchParams.getAll('deviceId');
  if(ids.length!==1||!(/^[A-Za-z0-9_-]{1,80}$/).test(ids[0]))return null;
  if(url.searchParams.toString()!==new URLSearchParams({deviceId:ids[0]}).toString())return null;
  return '/tabs/buoys'; // Lists pending offers; never routes to an unauthorized buoy.
 }catch{return null}
}
export function peekAppLink():string|null{
 try{return sessionStorage.getItem(KEY)}catch{return null}
}
export function clearAppLink():void{
 try{sessionStorage.removeItem(KEY)}catch{}
}
export function getPostLoginTarget():string{
 const candidate=peekAppLink();
 if(candidate){
  clearAppLink();
  return appLinkDestination(candidate)??'/tabs/overview';
 }
 return '/tabs/overview';
}

// Native Firebase action links are single-use bearer credentials: an Android
// verified App Link delivers them to BlueGuard, which alone calls Firebase.
// Do not pass these parameters to the Angular Router or post-login target.
// Never accept arbitrary HTTPS origins, duplicate/extra parameters or fragments.
export type NativeEmailAction={mode:'verifyEmail'|'resetPassword';code:string};
export function parseNativeEmailAction(raw:string):NativeEmailAction|null{
 if(!raw||raw.length>4096)return null;
 try{
  const url=new URL(raw);
  if(url.protocol!=='https:'||url.host!==environment.firebase.authDomain||
      url.username||url.password||url.hash)return null;
  const nativeAction=url.pathname==='/open/auth-action';
  const firebaseTemplate=url.pathname==='/__/auth/action';
  if(!nativeAction&&!firebaseTemplate)return null;
  const p=url.searchParams;
  const required=['mode','oobCode','apiKey'];
  const allowed=firebaseTemplate?[...required,'continueUrl','lang']:required;
  let count=0,unexpected=false;
  p.forEach((_,key)=>{count++;if(!allowed.includes(key))unexpected=true;});
  if(unexpected||count<3||count>allowed.length||
     required.some(key=>p.getAll(key).length!==1)||
     allowed.some(key=>p.getAll(key).length>1))return null;
  if(p.get('apiKey')!==environment.firebase.apiKey)return null;
  const mode=p.get('mode');
  if(mode!=='verifyEmail'&&mode!=='resetPassword')return null;
  const code=p.get('oobCode');
  if(!code||code.length>2048||!/^[A-Za-z0-9_-]+$/.test(code))return null;
  // Firebase SDK template links include a continueUrl and optional lang.
  // Never follow continueUrl or treat it as proof of account access.
  const continueUrl=p.get('continueUrl');
  if(continueUrl!==null){
    if(!firebaseTemplate||continueUrl.length>1500)return null;
    const next=new URL(continueUrl);
    if(next.protocol!=='https:'||next.host!==environment.firebase.authDomain||
       next.username||next.password||next.hash||
       !['/__/auth/links','/open/email-verified','/open/password-reset-complete'].includes(next.pathname))return null;
  }
  const lang=p.get('lang');
  if(lang!==null&&(!firebaseTemplate||!/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(lang)))return null;
  // The one-time code is staged in volatile AuthService memory only.
  return {mode,code};
 }catch{return null}
}
