import {inject,Injectable} from '@angular/core';import {HttpClient} from '@angular/common/http';import {Observable} from 'rxjs';
import {environment} from '../../environments/environment';import {Device,Alert,Health,Measurement,Config,Page,Profile} from './models';
@Injectable({providedIn:'root'})export class ApiService{
 private http=inject(HttpClient);private url=environment.api;
 me():Observable<Profile>{return this.http.get<Profile>(`${this.url}/auth/me`)}
 devices():Observable<{items:Device[]}>{return this.http.get<{items:Device[]}>(`${this.url}/devices`)}
 device(id:string):Observable<Device>{return this.http.get<Device>(`${this.url}/devices/${encodeURIComponent(id)}`)}
 history(id:string,cursor?:string,limit=30):Observable<Page<Measurement>>{const params:Record<string,string>={limit:String(limit)};if(cursor)params['cursor']=cursor;return this.http.get<Page<Measurement>>(`${this.url}/devices/${encodeURIComponent(id)}/measurements`,{params})}
 latest(id:string):Observable<Measurement>{return this.http.get<Measurement>(`${this.url}/devices/${encodeURIComponent(id)}/measurements/latest`)}
 health(id:string):Observable<Page<Health>>{return this.http.get<Page<Health>>(`${this.url}/devices/${encodeURIComponent(id)}/health`)}
 alerts():Observable<Page<Alert>>{return this.http.get<Page<Alert>>(`${this.url}/alerts`)}
 alert(id:string):Observable<Alert>{return this.http.get<Alert>(`${this.url}/alerts/${encodeURIComponent(id)}`)}
 acknowledge(id:string):Observable<unknown>{return this.http.patch(`${this.url}/alerts/${encodeURIComponent(id)}/acknowledge`,{})}
 config(id:string):Observable<Config>{return this.http.get<Config>(`${this.url}/devices/${encodeURIComponent(id)}/config`)}
 updateConfig(id:string,c:Config):Observable<Config>{return this.http.put<Config>(`${this.url}/devices/${encodeURIComponent(id)}/config`,c)}
 registerToken(token:string):Observable<unknown>{return this.http.post(`${this.url}/notifications/register-device`,{token,platform:'android',provider:'FCM'})}
 unregisterToken(token:string):Observable<unknown>{return this.http.request('DELETE',`${this.url}/notifications/unregister-device`,{body:{token,platform:'android',provider:'FCM'}})}
}
