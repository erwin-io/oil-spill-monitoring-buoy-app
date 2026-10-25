import {inject,Injectable} from '@angular/core';import {HttpClient} from '@angular/common/http';import {Observable} from 'rxjs';
import {environment} from '../../environments/environment';import {Device,Alert,Health,Measurement,Config,Page,Profile} from './models';
@Injectable({providedIn:'root'})export class ApiService{
 private http=inject(HttpClient);private url=environment.api;
 me():Observable<Profile>{return this.http.get<Profile>(`${this.url}/auth/me`)}
 devices():Observable<{items:Device[]}>{return this.http.get<{items:Device[]}>(`${this.url}/devices`)}
 device(id:string):Observable<Device>{return this.http.get<Device>(`${this.url}/devices/${encodeURIComponent(id)}`)}
 requestClaim(id:string,claimCode:string):Observable<{deviceId:string;challengeId:string;state:'PENDING'}>{return this.http.post<{deviceId:string;challengeId:string;state:'PENDING'}>(`${this.url}/devices/${encodeURIComponent(id)}/claims`,{claimCode})}
 claimStatus(id:string,challengeId:string):Observable<{state:'PENDING'|'CONFIRMED'|'EXPIRED';expiresAt:string}>{return this.http.get<{state:'PENDING'|'CONFIRMED'|'EXPIRED';expiresAt:string}>(`${this.url}/devices/${encodeURIComponent(id)}/claims/${encodeURIComponent(challengeId)}`)}
 incomingTransfers():Observable<{items:{deviceId:string;requestId:string;expiresAt:string}[]}>{return this.http.get<{items:{deviceId:string;requestId:string;expiresAt:string}[]}>(`${this.url}/transfers/incoming`)}
 startTransfer(id:string,email:string):Observable<{deviceId:string;requestId:string;state:string;expiresAt:string}>{return this.http.post<{deviceId:string;requestId:string;state:string;expiresAt:string}>(`${this.url}/devices/${encodeURIComponent(id)}/transfer`,{email})}
 cancelTransfer(id:string):Observable<unknown>{return this.http.delete(`${this.url}/devices/${encodeURIComponent(id)}/transfer`)}
 acceptTransfer(id:string,requestId:string):Observable<{access:'OWNER'}>{return this.http.post<{access:'OWNER'}>(`${this.url}/devices/${encodeURIComponent(id)}/transfer/accept`,{requestId})}
  invitations():Observable<{items:{deviceId:string;invitedAt:string}[]}>{return this.http.get<{items:{deviceId:string;invitedAt:string}[]}>(`${this.url}/invitations`)}
 acceptInvitation(id:string):Observable<{deviceId:string;access:'VIEWER'}>{return this.http.post<{deviceId:string;access:'VIEWER'}>(`${this.url}/devices/${encodeURIComponent(id)}/invitations/accept`,{})}
 inviteViewer(id:string,email:string):Observable<{deviceId:string;email:string;status:'PENDING'}>{return this.http.post<{deviceId:string;email:string;status:'PENDING'}>(`${this.url}/devices/${encodeURIComponent(id)}/invitations`,{email})}
 history(id:string,cursor?:string,limit=30):Observable<Page<Measurement>>{const params:Record<string,string>={limit:String(limit)};if(cursor)params['cursor']=cursor;return this.http.get<Page<Measurement>>(`${this.url}/devices/${encodeURIComponent(id)}/measurements`,{params})}
 latest(id:string):Observable<Measurement>{return this.http.get<Measurement>(`${this.url}/devices/${encodeURIComponent(id)}/measurements/latest`)}
 health(id:string):Observable<Page<Health>>{return this.http.get<Page<Health>>(`${this.url}/devices/${encodeURIComponent(id)}/health`)}
 alerts(cursor?:string,status?:string):Observable<Page<Alert>>{const params:Record<string,string>={limit:'30'};if(cursor)params['cursor']=cursor;if(status)params['status']=status;return this.http.get<Page<Alert>>(`${this.url}/alerts`,{params})}
 alert(id:string):Observable<Alert>{return this.http.get<Alert>(`${this.url}/alerts/${encodeURIComponent(id)}`)}
 markAllRead():Observable<{readAt:string;deviceCount:number}>{return this.http.post<{readAt:string;deviceCount:number}>(`${this.url}/notifications/read-all`,{})}
 markRead(id:string):Observable<{alertId:string;unread:boolean}>{return this.http.post<{alertId:string;unread:boolean}>(`${this.url}/alerts/${encodeURIComponent(id)}/read`,{})}
 acknowledge(id:string):Observable<unknown>{return this.http.patch(`${this.url}/alerts/${encodeURIComponent(id)}/acknowledge`,{})}
 config(id:string):Observable<Config>{return this.http.get<Config>(`${this.url}/devices/${encodeURIComponent(id)}/config`)}
 updateConfig(id:string,c:Config):Observable<Config>{return this.http.put<Config>(`${this.url}/devices/${encodeURIComponent(id)}/config`,c)}
 startPushSession(installationId:string):Observable<{sessionId:string;sessionSecret:string;expiresAt:string}>{
  return this.http.post<{sessionId:string;sessionSecret:string;expiresAt:string}>(`${this.url}/notifications/sessions`,{installationId})
 }
 refreshPushSession(sessionId:string,sessionSecret:string):Observable<{expiresAt:string}>{
  return this.http.post<{expiresAt:string}>(`${this.url}/notifications/sessions/${encodeURIComponent(sessionId)}/refresh`,{sessionSecret})
 }
 endPushSession(sessionId:string,sessionSecret:string):Observable<{revoked:boolean}>{
  return this.http.request<{revoked:boolean}>('DELETE',`${this.url}/notifications/sessions/${encodeURIComponent(sessionId)}`,{body:{sessionSecret}})
 }
 registerToken(token:string,sessionId:string,sessionSecret:string):Observable<unknown>{
  return this.http.post(`${this.url}/notifications/register-device`,{token,platform:'android',provider:'FCM',sessionId,sessionSecret})
 }
 unregisterToken(token:string):Observable<unknown>{return this.http.request('DELETE',`${this.url}/notifications/unregister-device`,{body:{token,platform:'android',provider:'FCM'}})}
}
