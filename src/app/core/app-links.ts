import {environment} from '../../environments/environment';

// No tokens or permissions in a URL. The API remains authoritative for Viewer/Owner.
const KEY='blueguard.pending-link.v1';
export function appLinkDestination(raw:string):string|null{
 if(!raw||raw.length>1024)return null;
 try{
  const url=new URL(raw);
  if(url.protocol!=='https:'||url.host!==environment.firebase.authDomain||
   (url.pathname!=='/open/invite'&&url.pathname!=='/open/transfer')||
   url.username||url.password||url.hash)return null;
  const ids=url.searchParams.getAll('deviceId');
  if(ids.length!==1||!(/^[A-Za-z0-9_-]{1,80}$/).test(ids[0]))return null;
  if([...url.searchParams.keys()].some(key=>key!=='deviceId'))return null;
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
