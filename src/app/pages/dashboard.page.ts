import {Component,inject} from '@angular/core';import {CommonModule} from '@angular/common';import {RouterLink} from '@angular/router';import {firstValueFrom} from 'rxjs';import {IonContent,IonHeader,IonToolbar,IonTitle,IonButton,IonRefresher,IonRefresherContent,IonSpinner} from '@ionic/angular/standalone';
import {ApiService} from '../core/api.service';import {Device,Alert} from '../core/models';import {RealtimeService} from '../core/realtime.service';import {PushService} from '../core/push.service';
@Component({standalone:true,imports:[CommonModule,RouterLink,IonContent,IonHeader,IonToolbar,IonTitle,IonButton,IonRefresher,IonRefresherContent,IonSpinner],templateUrl:'./dashboard.page.html',styleUrls:['./dashboard.page.scss']})export class DashboardPage {
 private api=inject(ApiService);readonly realtime=inject(RealtimeService);private push=inject(PushService);
 devices:Device[]=[];alerts:Alert[]=[];busy=true;error='';updated='';offlineMinutes=60;
 get online(){return this.devices.filter(d=>d.lastSeenAt&&Date.now()-Date.parse(d.lastSeenAt)<this.offlineMinutes*60000).length}
 get oil(){return this.devices.filter(d=>d.latestClassification==='PETROLEUM').length}
 get suspicious(){return this.devices.filter(d=>['INTERFERENCE','INCONCLUSIVE'].includes(d.latestClassification??'')).length}
 get lowBattery(){return this.devices.filter(d=>d.batteryPercent!==undefined&&d.batteryPercent<20).length}
 get maintenance(){return this.devices.filter(d=>d.cellStatus==='MAINTENANCE_REQUIRED').length}
 async ionViewWillEnter(){await this.reload();await this.push.start()}
 async reload(event?:any){this.busy=!event;this.error='';try{const [d,a]=await Promise.all([firstValueFrom(this.api.devices()),firstValueFrom(this.api.alerts())]);this.devices=d.items;this.alerts=a.items;this.updated=new Date().toISOString();this.realtime.connect(d.items.map(v=>v.id),()=>{void this.refreshSilent()})}catch(e){this.error=(e as Error).message}finally{this.busy=false;event?.target?.complete()}}
 async refreshSilent(){try{const [d,a]=await Promise.all([firstValueFrom(this.api.devices()),firstValueFrom(this.api.alerts())]);this.devices=d.items;this.alerts=a.items;this.updated=new Date().toISOString()}catch{this.error='Data may be stale. Pull to refresh.'}}
}
