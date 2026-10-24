import {Component,inject} from '@angular/core';import {CommonModule} from '@angular/common';import {FormsModule} from '@angular/forms';import {RouterLink} from '@angular/router';import {firstValueFrom} from 'rxjs';import {IonContent,IonHeader,IonToolbar,IonTitle,IonButton,IonSearchbar,IonSelect,IonSelectOption,IonRefresher,IonRefresherContent} from '@ionic/angular/standalone';import {ApiService} from '../core/api.service';import {Device} from '../core/models';
@Component({standalone:true,imports:[CommonModule,FormsModule,RouterLink,IonContent,IonHeader,IonToolbar,IonTitle,IonButton,IonSearchbar,IonSelect,IonSelectOption,IonRefresher,IonRefresherContent],templateUrl:'./devices.page.html',styleUrls:['./devices.page.scss']})export class DevicesPage{
 private api=inject(ApiService);items:Device[]=[];term='';filter='ALL';loading=true;error='';
 onSearch(value: string | null | undefined): void { this.term = value ?? ''; }
 onlineLabel(d:Device):string {if(d.status==='DISABLED')return 'Disabled';if(!d.lastSeenAt)return 'Not yet online';const age=Date.now()-Date.parse(d.lastSeenAt);return Number.isFinite(age)&&age>=0&&age<60*60*1000?'Online':'Offline';}
 get shown(){return this.items.filter(d=>(d.name+' '+d.id).toLowerCase().includes(this.term.toLowerCase())&&(this.filter==='ALL'||d.latestClassification===this.filter))}
 async ionViewWillEnter(){await this.load()}async load(event?:any){this.loading=true;this.error='';try{this.items=(await firstValueFrom(this.api.devices())).items}catch(e){this.error=(e as Error).message}finally{this.loading=false;event?.target?.complete()}}
}
